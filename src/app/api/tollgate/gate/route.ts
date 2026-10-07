import { NextResponse, type NextRequest } from "next/server";
import { publicOrigin } from "@/lib/origin";
import { prisma } from "@/lib/db";
import { detectBot } from "@/lib/tollgate/bots";
import {
  GATE_PATH_HEADER,
  GATE_REASON_HEADER,
  HEADERS,
  TOLLGATE_VERSION,
  parseLicense,
  type QuoteResponse,
} from "@/lib/tollgate/protocol";
import { issueQuote, recordVisit } from "@/lib/tollgate/service";

// Reached via the proxy's rewrite when an AI agent requests a gated page
// without a valid access token. Answers with HTTP 402 and a payable quote.
export async function GET(req: NextRequest) {
  const path = req.headers.get(GATE_PATH_HEADER) ?? req.nextUrl.searchParams.get("path");
  if (!path) return NextResponse.json({ error: "bad_request", message: "Missing path." }, { status: 400 });

  const reasonParam = req.headers.get(GATE_REASON_HEADER);
  const reason: QuoteResponse["reason"] =
    reasonParam === "token_expired" || reasonParam === "token_invalid" ? reasonParam : undefined;

  const license = parseLicense(req.headers.get(HEADERS.license));
  const origin = publicOrigin(req);
  const bot = detectBot(req.headers);
  const visit = {
    path,
    userAgent: req.headers.get("user-agent") ?? "",
    botName: bot.isBot ? bot.botName : undefined,
  };

  const quote = await issueQuote({ path, license, origin, reason, botName: visit.botName });

  if (quote.kind === "not_found") {
    return NextResponse.json({ error: "not_found", message: "No such resource." }, { status: 404 });
  }

  if (quote.kind === "free") {
    const resource = await prisma.resource.findUniqueOrThrow({ where: { path } });
    await recordVisit({ ...visit, resourceId: resource.id, outcome: "FREE_ACCESS" });
    return NextResponse.json({ resource: path, title: resource.title, license: "free", body: resource.body });
  }

  await recordVisit({ ...visit, resourceId: quote.resourceId, outcome: "QUOTED" });

  const { body } = quote;
  return NextResponse.json(body, {
    status: 402,
    headers: {
      [HEADERS.version]: TOLLGATE_VERSION,
      [HEADERS.quote]: body.quote_id,
      [HEADERS.price]: `${body.price.value} ${body.price.currency}`,
      "WWW-Authenticate": `Tollgate realm="${origin}", quote="${body.quote_id}"`,
      Link: `<${origin}/.well-known/tollgate.json>; rel="tollgate"`,
      "Cache-Control": "no-store",
    },
  });
}
