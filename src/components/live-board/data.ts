import "server-only";
import { prisma } from "@/lib/db";
import { DEMO_PUBLISHER_ID } from "@/lib/publisher";
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

const LIMIT = 40;
const resource = { select: { title: true, path: true } } as const;
// Test traffic stays out of the showcase (the dashboard still shows it): the Spend Guardian
// stress test (/api/guardian/simulate) and the load test's ScaleTestBot.
const notSimulation = {
  OR: [
    { botName: null },
    { NOT: { OR: [{ botName: { startsWith: "RunawayAgent/" } }, { botName: { startsWith: "ScaleTestBot/" } }] } },
  ],
};

/** The latest AI traffic for the demo publisher: unpaid 402s plus paid reads, newest first. */
export async function getBoardData(): Promise<{ events: BoardEvent[]; totals: BoardTotals }> {
  const mine = { resource: { publisherId: DEMO_PUBLISHER_ID } };
  const [quoted, paid, earned, paidReads, quotes, deals] = await Promise.all([
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
    prisma.deal.count({ where: { publisherId: DEMO_PUBLISHER_ID, status: { in: ["INVOICED", "PAID"] } } }),
  ]);

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
    totals: { earningsCents: earned._sum.amountCents ?? 0, paidReads, quotes, deals },
  };
}
