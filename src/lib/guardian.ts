import "server-only";
import { generateText } from "ai";
import { AGENT_MODELS, withModelFallback } from "@/lib/ai/models";
import { prisma } from "@/lib/db";

// Spend Guardian: a lightweight risk model for agent wallets. Like a card
// issuer's fraud check, it compares each payment with the agent's own history
// and holds payments that look like a runaway loop, a stolen key or a bug.
//
// Each signal gives a severity from 0 to 1. They are combined with a
// "noisy-OR": risk = 1 - (1 - s1)(1 - s2)..., so one strong signal or several
// moderate ones both raise the score, and it never exceeds 1.

export const HOLD_AT = 0.75;
export const FLAG_AT = 0.4;
const RECENT_MS = 10 * 60_000;
const HISTORY_MS = 7 * 86_400_000;
const COLD_START_10MIN_SPEND_CENTS = 30;

export type Signal = { name: string; severity: number; reason: string };
export type Assessment = { decision: "ALLOW" | "FLAG" | "HOLD"; score: number; signals: Signal[]; summary: string };

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

export async function assessPayment(opts: { agentId: string; resourceId: string; priceCents: number; now?: Date }): Promise<Assessment> {
  const now = opts.now ?? new Date();
  const paid = await prisma.quote.findMany({
    where: { agentId: opts.agentId, status: "PAID", paidAt: { gte: new Date(now.getTime() - HISTORY_MS) } },
    select: { resourceId: true, priceCents: true, paidAt: true },
    orderBy: { paidAt: "desc" },
    take: 1000,
  });
  const at = (q: (typeof paid)[number]) => (q.paidAt ?? now).getTime();
  const recent = paid.filter((q) => now.getTime() - at(q) < RECENT_MS);
  const history = paid.filter((q) => now.getTime() - at(q) >= RECENT_MS);
  const signals: Signal[] = [];

  // 1. Loop: buying the same article again while its access token is still valid.
  const repeats = recent.filter((q) => q.resourceId === opts.resourceId).length;
  if (repeats > 0) {
    signals.push({
      name: "repeat_purchase",
      severity: repeats >= 3 ? 1 : repeats === 2 ? 0.7 : 0.3,
      reason: `Already bought this same article ${repeats} time${repeats > 1 ? "s" : ""} in the last 10 minutes.`,
    });
  }

  // 2. Velocity: purchases in the last minute, absolute and against the agent's own busiest minute.
  const lastMinute = recent.filter((q) => now.getTime() - at(q) < 60_000).length + 1;
  const perMinute = new Map<number, number>();
  for (const q of history) perMinute.set(Math.floor(at(q) / 60_000), (perMinute.get(Math.floor(at(q) / 60_000)) ?? 0) + 1);
  const busiestMinute = Math.max(0, ...perMinute.values());
  const absolute = lastMinute > 5 ? clamp01((lastMinute - 5) / 10) : 0;
  const relative = busiestMinute > 0 && lastMinute >= 4 ? (lastMinute >= 3 * busiestMinute ? 0.8 : lastMinute >= 2 * busiestMinute ? 0.4 : 0) : 0;
  if (Math.max(absolute, relative) > 0) {
    signals.push({
      name: "velocity",
      severity: Math.max(absolute, relative),
      reason: `${lastMinute} purchases in the last minute${busiestMinute ? ` (its busiest minute before was ${busiestMinute})` : ""}.`,
    });
  }

  // 3. Burst: money spent in the last 10 minutes against its typical 10-minute spend.
  const spent10 = recent.reduce((s, q) => s + q.priceCents, 0) + opts.priceCents;
  const windows = new Map<number, number>();
  for (const q of history) windows.set(Math.floor(at(q) / RECENT_MS), (windows.get(Math.floor(at(q) / RECENT_MS)) ?? 0) + q.priceCents);
  const typical = [...windows.values()].sort((a, b) => a - b);
  const baseline = Math.max(COLD_START_10MIN_SPEND_CENTS, percentile(typical, 0.5));
  const ratio = spent10 / baseline;
  if (ratio >= 3) {
    signals.push({
      name: "spend_burst",
      severity: ratio >= 10 ? 1 : ratio >= 5 ? 0.7 : 0.4,
      reason: `${usd(spent10)} spent in 10 minutes, ${ratio.toFixed(1)}x its usual ${usd(baseline)}.`,
    });
  }

  // 4. Price: far above anything this agent normally pays.
  const prices = history.map((q) => q.priceCents).sort((a, b) => a - b);
  const p95 = percentile(prices, 0.95);
  if (prices.length >= 5 && opts.priceCents > 50 && opts.priceCents > 3 * p95) {
    signals.push({
      name: "price_outlier",
      severity: opts.priceCents > 6 * p95 ? 0.9 : 0.6,
      reason: `${usd(opts.priceCents)} is over ${Math.floor(opts.priceCents / Math.max(1, p95))}x what this agent usually pays (${usd(p95)}).`,
    });
  } else if (prices.length < 5 && opts.priceCents > 100) {
    signals.push({ name: "price_outlier", severity: 0.5, reason: `${usd(opts.priceCents)} is a large payment for a new agent.` });
  }

  // 5. Timing: an hour of day this agent has never been active in (weak on its own).
  if (history.length >= 20) {
    const hours = new Set(history.map((q) => new Date(at(q)).getUTCHours()));
    if (!hours.has(now.getUTCHours())) {
      signals.push({ name: "unusual_hour", severity: 0.2, reason: `First activity ever at ${now.getUTCHours()}:00 UTC.` });
    }
  }

  const score = 1 - signals.reduce((p, s) => p * (1 - s.severity), 1);
  const decision = score >= HOLD_AT ? "HOLD" : score >= FLAG_AT ? "FLAG" : "ALLOW";
  const summary = signals.length ? signals.map((s) => s.reason).join(" ") : "Normal spending.";
  return { decision, score: Math.round(score * 100) / 100, signals, summary };
}

/** Records a flag or hold; a hold also freezes the wallet until a human reviews it. */
export async function recordRisk(agentId: string, assessment: Assessment, payment: { resourceId: string; priceCents: number }) {
  const event = await prisma.riskEvent.create({
    data: {
      agentId,
      decision: assessment.decision,
      score: assessment.score,
      signals: assessment.signals,
      summary: assessment.summary,
      resourceId: payment.resourceId,
      priceCents: payment.priceCents,
    },
  });
  if (assessment.decision === "HOLD") {
    await prisma.agent.update({
      where: { id: agentId },
      data: { frozenAt: new Date(), frozenReason: assessment.summary.slice(0, 500) },
    });
  }
  return event;
}

/** Adds a plain-English note for the owner: what happened, likely cause, what to do. */
export async function explainRiskEvent(eventId: string) {
  const event = await prisma.riskEvent.findUnique({ where: { id: eventId }, include: { agent: true } });
  if (!event || event.aiNote) return;
  try {
    const text = await withModelFallback(AGENT_MODELS, async (model) => {
      const result = await generateText({
        model,
        temperature: 0.2,
        maxRetries: 1,
        system:
          "You write fraud-alert notes for the owner of an AI agent's wallet. Two short sentences: what happened in plain words, the most likely cause (a stuck loop, a bug, or a leaked API key), and the one action the owner should take. No jargon, no headings.",
        prompt: `Agent: ${event.agent.name}. Decision: ${event.decision} (risk ${event.score}). Signals: ${event.summary}`,
      });
      return result.text.trim();
    });
    await prisma.riskEvent.update({ where: { id: eventId }, data: { aiNote: text.slice(0, 800) } });
  } catch (err) {
    console.error("risk explanation failed", err);
  }
}
