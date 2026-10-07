import type { NextRequest } from "next/server";

/**
 * The site's public origin. Behind a proxy (Render, etc.) the request URL is
 * the internal one, e.g. https://localhost:10000, which outside agents and the
 * server's own fetches cannot use. Render sets RENDER_EXTERNAL_URL for us.
 */
export function publicOrigin(req: NextRequest) {
  const configured = process.env.PUBLIC_BASE_URL ?? process.env.RENDER_EXTERNAL_URL;
  if (configured) return configured.replace(/\/$/, "");

  const host = req.headers.get("x-forwarded-host");
  if (host) return `${req.headers.get("x-forwarded-proto") ?? "https"}://${host}`;

  return req.nextUrl.origin;
}
