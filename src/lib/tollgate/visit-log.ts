import { prisma } from "@/lib/db";

// Bot visits are analytics, not money, so they are buffered in memory and
// written in batches instead of one insert per request. A crash can lose at
// most one flush interval of analytics; payments are never buffered.
const FLUSH_MS = 2_000;
const MAX_BATCH = 500;

export type Visit = {
  path: string;
  userAgent: string;
  botName?: string;
  resourceId?: string;
  outcome: "QUOTED" | "PAID_ACCESS" | "FREE_ACCESS";
  priceCents?: number;
  license?: "READ" | "TRAIN";
};

let buffer: (Visit & { createdAt: Date })[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  timer = null;
  const batch = buffer;
  buffer = [];
  if (batch.length === 0) return;
  try {
    await prisma.botVisit.createMany({ data: batch });
  } catch (err) {
    // Analytics must never break the gate.
    console.error(`visit log flush failed (${batch.length} visits dropped)`, err);
  }
}

export function recordVisit(visit: Visit) {
  buffer.push({ ...visit, userAgent: visit.userAgent.slice(0, 500), createdAt: new Date() });
  if (buffer.length >= MAX_BATCH) void flush();
  else timer ??= setTimeout(() => void flush(), FLUSH_MS);
}
