import "server-only";
import { NextResponse, type NextRequest } from "next/server";

// Rate limits and run locks shared by every server instance when Upstash Redis
// is configured (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN), and kept
// in this process's memory otherwise, which is fine for a single instance.
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(commands: (string | number)[][]): Promise<{ result: unknown }[] | null> {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  try {
    const res = await fetch(`${REDIS_URL}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Upstash responded ${res.status}`);
    return await res.json();
  } catch (err) {
    // Redis trouble should degrade to per-instance limits, not take the API down.
    console.error("redis unavailable, using in-memory limits", err);
    return null;
  }
}

export function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

const memoryHits = new Map<string, number[]>();

function memoryLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (memoryHits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) return { allowed: false, retryAfter: Math.ceil((windowMs - (now - recent[0])) / 1000) };
  recent.push(now);
  memoryHits.set(key, recent);
  return { allowed: true, retryAfter: 0 };
}

/** Returns a 429 response when the caller exceeded `limit` calls per `windowMs`, otherwise null. */
export async function rateLimit(req: NextRequest, bucket: string, limit: number, windowMs: number) {
  const ip = clientIp(req);
  // Fixed window in Redis: one counter per caller per window.
  const window = Math.floor(Date.now() / windowMs);
  const key = `tollgate:rl:${bucket}:${ip}:${window}`;
  const shared = await redis([
    ["INCR", key],
    ["PEXPIRE", key, windowMs],
  ]);

  const outcome = shared
    ? {
        allowed: Number(shared[0].result) <= limit,
        retryAfter: Math.ceil(((window + 1) * windowMs - Date.now()) / 1000),
      }
    : memoryLimit(`${bucket}:${ip}`, limit, windowMs);

  if (outcome.allowed) return null;
  return NextResponse.json(
    { error: "rate_limited", message: `Demo limit reached. Try again in ${outcome.retryAfter}s.` },
    { status: 429, headers: { "Retry-After": String(outcome.retryAfter) } },
  );
}

const memoryLocks = new Map<string, number>();

/** Takes a named lock for at most `ttlMs`. Returns false if someone else holds it. */
export async function acquireLock(name: string, ttlMs: number) {
  const shared = await redis([["SET", `tollgate:lock:${name}`, "1", "NX", "PX", ttlMs]]);
  if (shared) return shared[0].result === "OK";

  const heldUntil = memoryLocks.get(name) ?? 0;
  if (heldUntil > Date.now()) return false;
  memoryLocks.set(name, Date.now() + ttlMs);
  return true;
}

export async function releaseLock(name: string) {
  const shared = await redis([["DEL", `tollgate:lock:${name}`]]);
  if (!shared) memoryLocks.delete(name);
}
