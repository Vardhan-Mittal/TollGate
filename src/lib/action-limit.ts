import "server-only";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Rate limit for server actions, which get no NextRequest. Builds one from the
 * incoming headers so the same per-IP buckets (Upstash or memory) apply.
 * Returns a message to show the visitor when the limit is hit, otherwise null.
 */
export async function limitAction(bucket: string, limit: number, windowMs: number): Promise<string | null> {
  const req = new NextRequest("http://action.internal/", { headers: new Headers(await headers()) });
  const limited = await rateLimit(req, bucket, limit, windowMs);
  if (!limited) return null;
  const body = (await limited.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? "Demo limit reached. Try again in a few minutes.";
}
