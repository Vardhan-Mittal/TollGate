import "server-only";
import { cacheLife } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { SIMULATION_AGENT_ID } from "@/lib/guardian-simulation";
import { DEMO_PUBLISHER_ID } from "@/lib/publisher";
import { notTestTraffic } from "@/lib/test-traffic";
import { accounts } from "@/lib/tollgate/service";

export type BoardEvent = {
  id: string;
  bot: string;
  title: string;
  path: string;
  outcome: "paid" | "quoted";
  priceCents: number;
  license: "read" | "train";
  time: string;
};

export type BoardTotals = {
  earningsCents: number;
  paidReads: number;
  quotes: number;
  deals: number;
};

export type PriceRow = {
  id: string;
  title: string;
  readCents: number;
  trainCents: number;
  aiReadCents: number | null;
  aiTrainCents: number | null;
  valueScore: number | null;
  overridden: boolean;
  reasoning: string | null;
};

export type DealStatus = "NEGOTIATING" | "NO_DEAL" | "INVOICED" | "PAID" | "FAILED";

export type DealRow = {
  id: string;
  agent: string;
  articles: number;
  listCents: number;
  agreedCents: number | null;
  status: DealStatus;
  time: string;
};

export type RiskRow = {
  id: string;
  agent: string;
  simulation: boolean;
  decision: "FLAG" | "HOLD";
  scorePct: number;
  summary: string;
  article: string | null;
  resolution: string | null;
  time: string;
};

export type BoardData = {
  events: BoardEvent[];
  totals: BoardTotals;
  pricing: PriceRow[];
  deals: { rows: DealRow[]; byStatus: Record<DealStatus, number>; licensedCents: number };
  guardian: { rows: RiskRow[]; total: number; held: number; flagged: number; open: number };
};

/** Landing-page showcase data: refreshed in the background every 30 s, never older than 5 minutes. */
export const SHOWCASE_CACHE = { stale: 30, revalidate: 30, expire: 300 };

const LIMIT = 40;
const SIDE_LIMIT = 20;
const resource = { select: { title: true, path: true } } as const;
// Test traffic stays out of the showcase (the dashboard grid still shows it).
const notSimulation = notTestTraffic;

/**
 * Everything the board's four tabs show for the demo publisher: live traffic (unpaid 402s plus
 * paid reads), AI pricing per article, agent-to-agent deals and Spend Guardian events.
 */
export async function getBoardData(): Promise<BoardData> {
  "use cache";
  // Cheap to serve stale for a few seconds: one set of queries every ~30 s instead of one per visitor.
  cacheLife(SHOWCASE_CACHE);
  const mine = { resource: { publisherId: DEMO_PUBLISHER_ID } };
  const dealsWhere = { publisherId: DEMO_PUBLISHER_ID };
  const [quoted, paid, earned, paidReads, quotes, pricing, dealRows, dealGroups, guardian] = await Promise.all([
    prisma.botVisit.findMany({
      where: { outcome: "QUOTED", ...mine, ...notSimulation },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      select: { id: true, botName: true, path: true, priceCents: true, license: true, createdAt: true, resource },
    }),
    prisma.quote.findMany({
      where: { status: "PAID", ...mine, ...notSimulation },
      orderBy: { paidAt: "desc" },
      take: LIMIT,
      select: {
        id: true,
        botName: true,
        priceCents: true,
        license: true,
        paidAt: true,
        createdAt: true,
        agent: { select: { name: true } },
        resource,
      },
    }),
    prisma.ledgerEntry.aggregate({
      _sum: { amountCents: true },
      where: { account: accounts.publisher(DEMO_PUBLISHER_ID), kind: "EARNING" },
    }),
    prisma.accessGrant.count({ where: mine }),
    prisma.botVisit.count({ where: { outcome: "QUOTED", ...mine } }),
    prisma.resource.findMany({
      where: { publisherId: DEMO_PUBLISHER_ID },
      orderBy: [{ valueScore: { sort: "desc", nulls: "last" } }, { publishedAt: "desc" }],
      take: SIDE_LIMIT,
      select: {
        id: true,
        title: true,
        priceReadCents: true,
        priceTrainCents: true,
        aiPriceReadCents: true,
        aiPriceTrainCents: true,
        valueScore: true,
        priceOverridden: true,
        aiReasoning: true,
      },
    }),
    prisma.deal.findMany({
      where: dealsWhere,
      orderBy: { createdAt: "desc" },
      take: SIDE_LIMIT,
      select: {
        id: true,
        status: true,
        listPriceCents: true,
        agreedPriceCents: true,
        resourceIds: true,
        createdAt: true,
        agent: { select: { name: true } },
      },
    }),
    prisma.deal.groupBy({ by: ["status"], where: dealsWhere, _count: { _all: true }, _sum: { agreedPriceCents: true } }),
    getGuardian(),
  ]);

  const byStatus: Record<DealStatus, number> = { NEGOTIATING: 0, NO_DEAL: 0, INVOICED: 0, PAID: 0, FAILED: 0 };
  let licensedCents = 0;
  for (const g of dealGroups) {
    byStatus[g.status] = g._count._all;
    if (g.status === "INVOICED" || g.status === "PAID") licensedCents += g._sum.agreedPriceCents ?? 0;
  }

  const events: BoardEvent[] = [
    ...quoted.map((v) => ({
      id: `v_${v.id}`,
      bot: v.botName ?? "Unknown bot",
      title: v.resource?.title ?? v.path,
      path: v.resource?.path ?? v.path,
      outcome: "quoted" as const,
      priceCents: v.priceCents ?? 0,
      license: v.license === "TRAIN" ? ("train" as const) : ("read" as const),
      time: v.createdAt.toISOString(),
    })),
    ...paid.map((q) => ({
      id: `q_${q.id}`,
      // The bot's own user-agent, so paid and quoted rows from one bot match.
      bot: q.botName ?? q.agent?.name ?? "Unknown bot",
      title: q.resource.title,
      path: q.resource.path,
      outcome: "paid" as const,
      priceCents: q.priceCents,
      license: q.license === "TRAIN" ? ("train" as const) : ("read" as const),
      time: (q.paidAt ?? q.createdAt).toISOString(),
    })),
  ]
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, LIMIT);

  return {
    events,
    totals: {
      earningsCents: earned._sum.amountCents ?? 0,
      paidReads,
      quotes,
      deals: byStatus.INVOICED + byStatus.PAID,
    },
    pricing: pricing.map((r) => ({
      id: r.id,
      title: r.title,
      readCents: r.priceReadCents,
      trainCents: r.priceTrainCents,
      aiReadCents: r.aiPriceReadCents,
      aiTrainCents: r.aiPriceTrainCents,
      valueScore: r.valueScore,
      overridden: r.priceOverridden,
      reasoning: r.aiReasoning,
    })),
    deals: {
      rows: dealRows.map((d) => ({
        id: d.id,
        agent: d.agent.name,
        articles: d.resourceIds.length,
        listCents: d.listPriceCents,
        agreedCents: d.agreedPriceCents,
        status: d.status,
        time: d.createdAt.toISOString(),
      })),
      byStatus,
      licensedCents,
    },
    guardian,
  };
}

/** Spend Guardian events on the demo publisher's articles (RiskEvent has no publisher column). */
async function getGuardian(): Promise<BoardData["guardian"]> {
  const articles = await prisma.resource.findMany({
    where: { publisherId: DEMO_PUBLISHER_ID },
    select: { id: true, title: true },
  });
  const where: Prisma.RiskEventWhereInput = {
    resourceId: { in: articles.map((a) => a.id) },
    decision: { in: ["FLAG", "HOLD"] },
  };
  const [rows, byDecision, open] = await Promise.all([
    prisma.riskEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: SIDE_LIMIT,
      select: {
        id: true,
        agentId: true,
        decision: true,
        score: true,
        summary: true,
        resourceId: true,
        resolution: true,
        createdAt: true,
        agent: { select: { name: true } },
      },
    }),
    prisma.riskEvent.groupBy({ by: ["decision"], where, _count: { _all: true } }),
    prisma.riskEvent.count({ where: { ...where, resolvedAt: null } }),
  ]);
  const titles = new Map(articles.map((a) => [a.id, a.title]));
  const count = (d: "FLAG" | "HOLD") => byDecision.find((g) => g.decision === d)?._count._all ?? 0;
  return {
    rows: rows.map((e) => ({
      id: e.id,
      agent: e.agent.name,
      simulation: e.agentId === SIMULATION_AGENT_ID,
      decision: e.decision === "HOLD" ? "HOLD" : "FLAG",
      scorePct: Math.round(e.score * 100),
      summary: e.summary,
      article: e.resourceId ? (titles.get(e.resourceId) ?? null) : null,
      resolution: e.resolution,
      time: e.createdAt.toISOString(),
    })),
    total: count("FLAG") + count("HOLD"),
    held: count("HOLD"),
    flagged: count("FLAG"),
    open,
  };
}
