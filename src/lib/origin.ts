import type { NextRequest } from "next/server";

function configuredOrigin() {
  const configured = process.env.PUBLIC_BASE_URL ?? process.env.RENDER_EXTERNAL_URL;
  return configured ? configured.replace(/\/$/, "") : null;
}

/**
 * The site's public origin, for URLs handed to users and outside agents
 * (pay_url, PayPal return URLs). Behind a proxy (Render, etc.) the request URL
 * is the internal one, e.g. https://localhost:10000. Render sets
 * RENDER_EXTERNAL_URL for us. Never use this for the server's own fetches: the
 * fallback trusts request headers.
 */
export function publicOrigin(req: NextRequest) {
  const configured = configuredOrigin();
  if (configured) return configured;

  const host = req.headers.get("x-forwarded-host");
  if (host) return `${req.headers.get("x-forwarded-proto") ?? "https"}://${host}`;

  return req.nextUrl.origin;
}

/**
 * Origin for server-to-self calls (the research agent and the Guardian
 * simulation send an agent key there), so it must never come from the request:
 * a forged Host / X-Forwarded-Host would send the key to someone else's server.
 */
export function internalOrigin() {
  const configured = configuredOrigin();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Set PUBLIC_BASE_URL (or RENDER_EXTERNAL_URL) so the server can call itself safely.");
  }
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
