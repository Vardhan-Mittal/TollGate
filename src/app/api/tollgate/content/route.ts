import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { detectBot } from "@/lib/tollgate/bots";
import { GATE_PATH_HEADER } from "@/lib/tollgate/protocol";
import { recordVisit } from "@/lib/tollgate/service";
import { readTollgateToken, verifyAccessToken } from "@/lib/tollgate/token";

// Clean-text delivery for paying agents. Verifies the token itself rather than
// trusting the proxy, because this route is reachable directly too.
export async function GET(req: NextRequest) {
  const path = req.headers.get(GATE_PATH_HEADER) ?? req.nextUrl.searchParams.get("path");
  const token = readTollgateToken(req.headers);
  if (!path || !token) {
    return NextResponse.json({ error: "unauthorized", message: "Missing path or Tollgate token." }, { status: 401 });
  }

  const result = await verifyAccessToken(token, path);
  if (!result.ok) return NextResponse.json({ error: result.reason, message: "Token rejected." }, { status: 401 });

  const resource = await prisma.resource.findUnique({ where: { path }, include: { publisher: true } });
  if (!resource) return NextResponse.json({ error: "not_found", message: "No such resource." }, { status: 404 });

  const bot = detectBot(req.headers);
  await recordVisit({
    path,
    userAgent: req.headers.get("user-agent") ?? "",
    botName: bot.isBot ? bot.botName : undefined,
    resourceId: resource.id,
    outcome: "PAID_ACCESS",
  });

  return NextResponse.json(
    {
      resource: resource.path,
      title: resource.title,
      publisher: resource.publisher.name,
      published_at: resource.publishedAt.toISOString(),
      license: result.claims.license,
      body: resource.body,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
