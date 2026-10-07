import "server-only";
import { NextResponse, type NextRequest } from "next/server";

// Small in-memory sliding-window limiter. Enough for a single-instance demo
// server; it protects the Gemini free tier and the sandbox from scripted abuse.
const hits = new Map<string, number[]>();

export function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

/** Returns a 429 response when `key` has made more than `limit` calls in `windowMs`, otherwise null. */
export function rateLimit(req: NextRequest, bucket: string, limit: number, windowMs: number) {
  const key = `${bucket}:${clientIp(req)}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    const retryAfter = Math.ceil((windowMs - (now - recent[0])) / 1000);
    return NextResponse.json(
      { error: "rate_limited", message: `Demo limit reached. Try again in ${retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  recent.push(now);
  hits.set(key, recent);
  return null;
}
