import { prisma } from "@/lib/db";

// Article prices change rarely but are read on every bot request. A short
// per-instance cache keeps a crawler storm off the database; a price change
// reaches every instance within the TTL (and this one immediately).
const TTL_MS = 60_000;

type CachedResource = Awaited<ReturnType<typeof load>>;
const cache = new Map<string, { value: CachedResource; expires: number }>();

function load(path: string) {
  return prisma.resource.findUnique({
    where: { path },
    select: { id: true, path: true, title: true, teaser: true, publisherId: true, priceReadCents: true, priceTrainCents: true },
  });
}

/** Looks up a gated article by path, caching hits and misses for a minute. */
export async function getResourceByPath(path: string) {
  const hit = cache.get(path);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await load(path);
  cache.set(path, { value, expires: Date.now() + TTL_MS });
  return value;
}

/** Drops cached prices after the publisher or the AI changes them. */
export function invalidateResourceCache() {
  cache.clear();
}
