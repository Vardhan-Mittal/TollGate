import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { DEMO_PUBLISHER_ID } from "@/lib/publisher";
import { PLATFORM_FEE_BPS } from "@/lib/tollgate/protocol";
import { accounts } from "@/lib/tollgate/service";

export type LiveEvent = {
  id: string;
  at: string;
  kind: "quote" | "earning" | "topup" | "auto_recharge" | "payout" | "deal";
  title: string;
  detail: string;
  amountCents: number;
};

export type LiveFeed = {
  now: string;
  publisher: { name: string; balanceCents: number; earnedTodayCents: number; paidReadsToday: number };
  events: LiveEvent[];
};

const MAX_LOOKBACK_MS = 60 * 60 * 1000;

// Publisher-side view for the /live page, read straight from the database so
// it shows what the seller actually received, independently of the agent.
export async function GET(req: NextRequest) {
  const sinceParam = Date.parse(req.nextUrl.searchParams.get("since") ?? "");
  const since = new Date(Math.max(Number.isNaN(sinceParam) ? 0 : sinceParam, Date.now() - MAX_LOOKBACK_MS));
  const dayStart = new Date(Date.now() - 86_400_000);
  const now = new Date();

  const [publisher, earnedToday, paidReadsToday, quotes, grants, topUps, payouts, deals] = await Promise.all([
    prisma.publisher.findUniqueOrThrow({ where: { id: DEMO_PUBLISHER_ID } }),
    prisma.ledgerEntry.aggregate({
      _sum: { amountCents: true },
      where: { account: accounts.publisher(DEMO_PUBLISHER_ID), kind: "EARNING", createdAt: { gte: dayStart } },
    }),
    prisma.accessGrant.count({ where: { createdAt: { gte: dayStart }, resource: { publisherId: DEMO_PUBLISHER_ID } } }),
    prisma.quote.findMany({
      where: { createdAt: { gt: since }, resource: { publisherId: DEMO_PUBLISHER_ID } },
      include: { resource: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.accessGrant.findMany({
      where: { createdAt: { gt: since }, resource: { publisherId: DEMO_PUBLISHER_ID } },
      include: { resource: true, agent: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.topUp.findMany({
      where: { status: "COMPLETED", completedAt: { gt: since } },
      include: { agent: true },
      orderBy: { completedAt: "desc" },
      take: 10,
    }),
    prisma.payout.findMany({
      where: { publisherId: DEMO_PUBLISHER_ID, createdAt: { gt: since } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.deal.findMany({
      where: { publisherId: DEMO_PUBLISHER_ID, updatedAt: { gt: since }, status: { in: ["INVOICED", "PAID"] } },
      include: { agent: true },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
  ]);

  const events: LiveEvent[] = [
    ...quotes.map((q) => ({
      id: `q-${q.id}`,
      at: q.createdAt.toISOString(),
      kind: "quote" as const,
      title: `402 quote sent to ${q.botName ?? "an AI agent"}`,
      detail: q.resource.title,
      amountCents: q.priceCents,
    })),
    ...grants.map((g) => ({
      id: `g-${g.id}`,
      at: g.createdAt.toISOString(),
      kind: "earning" as const,
      title: `${g.agent.name} paid to read`,
      detail: g.resource.title,
      amountCents: g.priceCents - Math.floor((g.priceCents * PLATFORM_FEE_BPS) / 10_000),
    })),
    ...topUps.map((t) => ({
      id: `t-${t.id}`,
      at: (t.completedAt ?? t.createdAt).toISOString(),
      kind: t.automatic ? ("auto_recharge" as const) : ("topup" as const),
      title: t.automatic ? "PayPal auto-recharge (saved PayPal, no human)" : "Agent wallet funded with PayPal",
      detail: t.agent.name,
      amountCents: t.amountCents,
    })),
    ...payouts.map((p) => ({
      id: `p-${p.id}`,
      at: p.createdAt.toISOString(),
      kind: "payout" as const,
      title: "Cashed out with PayPal Payouts",
      detail: p.status.toLowerCase(),
      amountCents: p.amountCents,
    })),
    ...deals.map((d) => ({
      id: `d-${d.id}-${d.status}`,
      at: d.updatedAt.toISOString(),
      kind: "deal" as const,
      title: d.status === "PAID" ? "Training license paid via PayPal invoice" : "AI agents agreed a training license · PayPal invoice sent",
      detail: `${d.agent.name} · ${d.resourceIds.length} articles`,
      amountCents: d.agreedPriceCents ?? 0,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const feed: LiveFeed = {
    now: now.toISOString(),
    publisher: {
      name: publisher.name,
      balanceCents: publisher.balanceCents,
      earnedTodayCents: earnedToday._sum.amountCents ?? 0,
      paidReadsToday,
    },
    events,
  };
  return NextResponse.json(feed, { headers: { "Cache-Control": "no-store" } });
}
