import { Suspense } from "react";
import { PageHeader, PageShell, SectionLabel, ui } from "@/components/ui/kit";
import { PRICE_LIMITS } from "@/lib/ai/pricing";
import { prisma } from "@/lib/db";
import { DEMO_MODE, DEMO_PAYOUT_EMAIL } from "@/lib/demo";
import { formatCents } from "@/lib/money";
import { MIN_PAYOUT_CENTS, refreshPayout } from "@/lib/payouts";
import { DEMO_PUBLISHER_ID } from "@/lib/publisher";
import { PLATFORM_FEE_BPS } from "@/lib/tollgate/protocol";
import { accounts } from "@/lib/tollgate/service";
import { AnalyticsSection, AnalyticsSkeleton } from "./analytics/analytics-section";
import { CashOutForm } from "./cash-out-form";
import { FinanceAssistant } from "./finance-assistant";
import { RepriceButton } from "./reprice-button";
import { PricingGrid, type PriceRow } from "./pricing-grid";
import { TrafficGrid, type TrafficRow } from "./traffic-grid";

export default function DashboardPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Publisher · The Grid Ledger"
        title="Publisher dashboard,"
        accent="what AI paid you."
        description="What AI agents paid to read The Grid Ledger, and your PayPal payouts."
      />
      <Suspense fallback={<p className={`mt-12 text-sm ${ui.muted}`}>Loading…</p>}>
        <Dashboard />
      </Suspense>
    </PageShell>
  );
}

const STATUS_STYLE = {
  PENDING: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  SUCCESS: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  FAILED: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
};

const ROWS = "divide-y divide-zinc-200/70 border-t border-zinc-200/70 text-sm dark:divide-white/[0.06] dark:border-white/[0.06]";

async function Dashboard() {
  // Pull fresh status from PayPal for payouts still in flight, but never wait more than 2 s:
  // a slow PayPal shouldn't hold the dashboard. A late refresh still lands for the next view.
  const pending = await prisma.payout.findMany({ where: { publisherId: DEMO_PUBLISHER_ID, status: "PENDING" } });
  const refreshing = Promise.all(pending.map((p) => refreshPayout(p.id).catch((err) => console.error("refreshPayout", err))));
  await Promise.race([refreshing, new Promise((resolve) => setTimeout(resolve, 2_000))]);

  const account = accounts.publisher(DEMO_PUBLISHER_ID);
  const [publisher, earned, paidReads, quotes, payouts, visits, resources, quotedVisits, paidQuotes] = await Promise.all([
    prisma.publisher.findUniqueOrThrow({ where: { id: DEMO_PUBLISHER_ID } }),
    prisma.ledgerEntry.aggregate({ _sum: { amountCents: true }, where: { account, kind: "EARNING" } }),
    prisma.accessGrant.count({ where: { resource: { publisherId: DEMO_PUBLISHER_ID } } }),
    // Quotes are signed tokens; unpaid 402s live in the visit log.
    prisma.botVisit.count({ where: { outcome: "QUOTED", resource: { publisherId: DEMO_PUBLISHER_ID } } }),
    prisma.payout.findMany({ where: { publisherId: DEMO_PUBLISHER_ID }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.botVisit.findMany({ orderBy: { createdAt: "desc" }, take: 12, include: { resource: true } }),
    prisma.resource.findMany({
      where: { publisherId: DEMO_PUBLISHER_ID },
      orderBy: { publishedAt: "desc" },
      include: { _count: { select: { grants: true } } },
    }),
    prisma.botVisit.findMany({
      where: { outcome: "QUOTED", resource: { publisherId: DEMO_PUBLISHER_ID } },
      orderBy: { createdAt: "desc" },
      take: 400,
      include: { resource: true },
    }),
    prisma.quote.findMany({
      where: { status: "PAID", resource: { publisherId: DEMO_PUBLISHER_ID } },
      orderBy: { paidAt: "desc" },
      take: 400,
      include: { resource: true, agent: true },
    }),
  ]);

  const trafficRows: TrafficRow[] = [
    ...quotedVisits.map((v) => ({
      time: v.createdAt.toISOString(),
      agent: v.botName ?? "Unknown bot",
      article: v.resource?.title ?? v.path,
      license: (v.license === "TRAIN" ? "train" : "read") as TrafficRow["license"],
      outcome: "quoted" as const,
      priceCents: v.priceCents ?? 0,
      publisherCents: 0,
    })),
    ...paidQuotes.map((q) => ({
      time: (q.paidAt ?? q.createdAt).toISOString(),
      agent: q.agent?.name ?? q.botName ?? "Unknown bot",
      article: q.resource.title,
      license: (q.license === "TRAIN" ? "train" : "read") as TrafficRow["license"],
      outcome: "paid" as const,
      priceCents: q.priceCents,
      publisherCents: q.priceCents - Math.floor((q.priceCents * PLATFORM_FEE_BPS) / 10_000),
    })),
  ];

  const priceRows: PriceRow[] = resources.map((r) => ({
    id: r.id,
    title: r.title,
    reasoning: r.aiReasoning,
    valueScore: r.valueScore,
    aiReadCents: r.aiPriceReadCents,
    aiTrainCents: r.aiPriceTrainCents,
    readCents: r.priceReadCents,
    trainCents: r.priceTrainCents,
    paidReads: r._count.grants,
    overridden: r.priceOverridden,
  }));
  // Remount the grid when the server data changes (e.g. after AI re-pricing).
  const priceRowsKey = priceRows.map((r) => `${r.id}:${r.readCents}:${r.trainCents}:${r.aiReadCents}:${r.valueScore}`).join("|");

  const stats = [
    { label: "Available to cash out", value: `$${(publisher.balanceCents / 100).toFixed(2)}` },
    { label: "Earned all time (after 10% fee)", value: `$${((earned._sum.amountCents ?? 0) / 100).toFixed(2)}` },
    { label: "Paid agent reads", value: paidReads.toString() },
    { label: "402 quotes issued", value: quotes.toString() },
  ];

  return (
    <div className="mt-12 flex flex-col gap-10">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.label} className={`${ui.card} flex min-w-0 flex-col justify-between gap-3 p-4 sm:p-5`}>
            <p className={ui.label}>{s.label}</p>
            <p
              className={`font-mono text-2xl font-medium tracking-tight tabular-nums sm:text-3xl ${i === 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsSection />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${ui.card} min-w-0 p-5 sm:p-6`}>
          <SectionLabel>Cash out</SectionLabel>
          <CashOutForm
            defaultEmail={publisher.paypalEmail ?? ""}
            lockedEmail={DEMO_MODE ? DEMO_PAYOUT_EMAIL : null} balanceCents={publisher.balanceCents} minCents={MIN_PAYOUT_CENTS} />

          <div className="mt-8">
            <SectionLabel>Payout history</SectionLabel>
            {payouts.length === 0 ? (
              <p className="text-sm text-zinc-500">No payouts yet.</p>
            ) : (
              <ul className={ROWS}>
                {payouts.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0 break-words">
                      <span className="font-mono font-medium tabular-nums">${(p.amountCents / 100).toFixed(2)}</span>
                      <span className="ml-2 text-zinc-500">to {p.receiverEmail}</span>
                      {p.failureReason && <span className="block text-xs text-red-600 dark:text-red-400">{p.failureReason}</span>}
                    </span>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[p.status]}`}
                      title={p.paypalStatus ?? ""}
                    >
                      {p.status === "PENDING" && p.paypalStatus?.endsWith("UNCLAIMED") ? "unclaimed" : p.status.toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className={`${ui.card} min-w-0 p-5 sm:p-6`}>
          <SectionLabel>Recent AI agent visits</SectionLabel>
          {visits.length === 0 ? (
            <p className="text-sm text-zinc-500">No bots yet.</p>
          ) : (
            <ul className={ROWS}>
              {visits.map((v) => (
                <li key={v.id} className="flex items-baseline justify-between gap-3 py-2.5">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{v.botName ?? "Unknown bot"}</span>
                    <span className="ml-2 text-zinc-500">{v.resource?.title ?? v.path}</span>
                  </span>
                  <span
                    className={`shrink-0 font-mono text-xs ${v.outcome === "PAID_ACCESS" ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"}`}
                  >
                    {v.outcome === "PAID_ACCESS" ? "paid" : v.outcome === "QUOTED" ? "got 402" : "free"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <TrafficGrid rows={trafficRows} />

      <FinanceAssistant />

      <section className={`${ui.card} min-w-0 p-5 sm:p-6`}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <SectionLabel>Articles &amp; AI pricing</SectionLabel>
            <p className={`text-sm text-pretty ${ui.muted}`}>
              AI appraises each article and suggests prices within your limits ({formatCents(PRICE_LIMITS.readMinCents)}–
              {formatCents(PRICE_LIMITS.readMaxCents)} to read, up to {formatCents(PRICE_LIMITS.trainMaxCents)} to train). Override any price in the grid; your prices win.
            </p>
          </div>
          <RepriceButton />
        </div>
        <PricingGrid key={priceRowsKey} rows={priceRows} />
      </section>
    </div>
  );
}
