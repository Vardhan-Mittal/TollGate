import "server-only";
import { prisma } from "@/lib/db";
import { SIMULATION_AGENT_ID } from "@/lib/guardian-simulation";
import { DEMO_PUBLISHER_ID } from "@/lib/publisher";
import { notTestTraffic, testBotLikePatterns } from "@/lib/test-traffic";
import { accounts } from "@/lib/tollgate/service";

export const REVENUE_DAYS = 14;
export const TRAFFIC_DAYS = 30;
const DAY_MS = 86_400_000;

export type RevenueDay = { day: string; cents: number };
export type PricePoint = { cents: number; reads: number };
export type HeatCell = { dow: number; hour: number; visits: number };

export type Analytics = {
  revenue: RevenueDay[];
  decisions: { paid: number; quoted: number };
  prices: PricePoint[];
  heatmap: HeatCell[];
};

// Test traffic never counts (same rule as the live board), nor the simulation wallet's test-credit purchases.
const notTestBot = notTestTraffic;

/** UTC calendar day, e.g. "2026-11-03". */
function utcDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Everything the analytics cards need, aggregated in the database: at most 14 day rows,
 * one row per distinct price and 168 heatmap rows come back, never raw events.
 * Reads the clock, so call it at request time (after `connection()`).
 */
export async function getAnalytics(): Promise<Analytics> {
  const now = Date.now();
  const since = new Date(now - TRAFFIC_DAYS * DAY_MS);
  const mine = { resource: { publisherId: DEMO_PUBLISHER_ID } };
  const paidWhere = {
    ...mine,
    createdAt: { gte: since },
    agentId: { not: SIMULATION_AGENT_ID },
    quote: notTestBot,
  };

  const [earnings, priceGroups, quoted, heat] = await Promise.all([
    // Ledger timestamps are stored as UTC; the window starts at UTC midnight 13 days ago.
    prisma.$queryRaw<{ day: string; cents: number }[]>`
      SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day, SUM("amountCents")::int AS cents
      FROM "LedgerEntry"
      WHERE account = ${accounts.publisher(DEMO_PUBLISHER_ID)}
        AND kind = 'EARNING'
        AND "createdAt" >= date_trunc('day', now() AT TIME ZONE 'UTC') - interval '13 days'
      GROUP BY 1`,
    prisma.accessGrant.groupBy({
      by: ["priceCents"],
      where: paidWhere,
      _count: { _all: true },
      orderBy: { priceCents: "asc" },
    }),
    prisma.botVisit.count({ where: { ...mine, ...notTestBot, outcome: "QUOTED", createdAt: { gte: since } } }),
    prisma.$queryRaw<{ dow: number; hour: number; visits: number }[]>`
      SELECT EXTRACT(ISODOW FROM v."createdAt")::int AS dow,
             EXTRACT(HOUR FROM v."createdAt")::int AS hour,
             COUNT(*)::int AS visits
      FROM "BotVisit" v
      JOIN "Resource" r ON r.id = v."resourceId"
      WHERE r."publisherId" = ${DEMO_PUBLISHER_ID}
        AND v.outcome IN ('QUOTED', 'PAID_ACCESS')
        AND v."createdAt" >= (now() AT TIME ZONE 'UTC') - interval '30 days' -- TRAFFIC_DAYS
        AND (v."botName" IS NULL OR v."botName" NOT LIKE ALL(${testBotLikePatterns}))
      GROUP BY 1, 2`,
  ]);

  const byDay = new Map(earnings.map((e) => [e.day, Number(e.cents)]));
  const today = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate());
  // The SQL windows use the database clock (UTC); both are "today" to within a request.
  const revenue = Array.from({ length: REVENUE_DAYS }, (_, i) => {
    const day = utcDay(new Date(today - (REVENUE_DAYS - 1 - i) * DAY_MS));
    return { day, cents: byDay.get(day) ?? 0 };
  });

  const prices = priceGroups.map((g) => ({ cents: g.priceCents, reads: g._count._all }));
  const paid = prices.reduce((sum, p) => sum + p.reads, 0);

  return {
    revenue,
    decisions: { paid, quoted },
    prices,
    // ISO day of week: 1 = Monday … 7 = Sunday.
    heatmap: heat.map((h) => ({ dow: Number(h.dow), hour: Number(h.hour), visits: Number(h.visits) })),
  };
}
