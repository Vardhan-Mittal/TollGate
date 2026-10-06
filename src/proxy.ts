import { NextResponse, type NextRequest } from "next/server";
import { detectBot } from "@/lib/tollgate/bots";
import { GATE_PATH_HEADER, GATE_REASON_HEADER } from "@/lib/tollgate/protocol";
import { readTollgateToken, verifyAccessToken } from "@/lib/tollgate/token";

// The gate. Humans read for free. AI agents either present a valid Tollgate
// access token for this exact page, or get rewritten to the 402 quote route.
export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const token = readTollgateToken(req.headers);

  if (token) {
    const result = await verifyAccessToken(token, path);
    if (!result.ok) return rewriteTo(req, "/api/tollgate/gate", { path, reason: result.reason });

    // Agents asking for JSON get clean text instead of HTML.
    const wantsJson = req.headers.get("accept")?.includes("application/json");
    return wantsJson ? rewriteTo(req, "/api/tollgate/content", { path }) : NextResponse.next();
  }

  if (!detectBot(req.headers).isBot) return NextResponse.next();

  return rewriteTo(req, "/api/tollgate/gate", { path });
}

// Rewrite targets read the original path and reason from request headers.
// Client-sent copies are always overwritten or removed here.
function rewriteTo(req: NextRequest, pathname: string, params: { path: string; reason?: string }) {
  const headers = new Headers(req.headers);
  headers.set(GATE_PATH_HEADER, params.path);
  if (params.reason) headers.set(GATE_REASON_HEADER, params.reason);
  else headers.delete(GATE_REASON_HEADER);
  return NextResponse.rewrite(new URL(pathname, req.url), { request: { headers } });
}

export const config = {
  matcher: "/blog/:slug",
};
