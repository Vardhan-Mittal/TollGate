import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { MIN_PAYOUT_CENTS, refreshPayout } from "@/lib/payouts";
import { DEMO_PUBLISHER_ID } from "@/lib/publisher";
import { accounts } from "@/lib/tollgate/service";
import { CashOutForm } from "./cash-out-form";

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Publisher dashboard</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">What AI agents paid to read The Grid Ledger, and your PayPal payouts.</p>
      <Suspense fallback={<p className="mt-8 text-zinc-500">Loading…</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}

const STATUS_STYLE = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  SUCCESS: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

async function Dashboard() {
  // Pull fresh status from PayPal for payouts still in flight.
  const pending = await prisma.payout.findMany({ where: { publisherId: DEMO_PUBLISHER_ID, status: "PENDING" } });
  await Promise.all(pending.map((p) => refreshPayout(p.id).catch((err) => console.error("refreshPayout", err))));

  const account = accounts.publisher(DEMO_PUBLISHER_ID);
  const [publisher, earned, paidReads, quotes, payouts, visits, resources] = await Promise.all([
    prisma.publisher.findUniqueOrThrow({ where: { id: DEMO_PUBLISHER_ID } }),
    prisma.ledgerEntry.aggregate({ _sum: { amountCents: true }, where: { account, kind: "EARNING" } }),
    prisma.accessGrant.count({ where: { resource: { publisherId: DEMO_PUBLISHER_ID } } }),
    prisma.quote.count({ where: { resource: { publisherId: DEMO_PUBLISHER_ID } } }),
    prisma.payout.findMany({ where: { publisherId: DEMO_PUBLISHER_ID }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.botVisit.findMany({ orderBy: { createdAt: "desc" }, take: 12, include: { resource: true } }),
    prisma.resource.findMany({
      where: { publisherId: DEMO_PUBLISHER_ID },
      orderBy: { publishedAt: "desc" },
      include: { _count: { select: { grants: true } } },
    }),
  ]);

  const stats = [
    { label: "Available to cash out", value: `$${(publisher.balanceCents / 100).toFixed(2)}` },
    { label: "Earned all time (after 10% fee)", value: `$${((earned._sum.amountCents ?? 0) / 100).toFixed(2)}` },
    { label: "Paid agent reads", value: paidReads.toString() },
    { label: "402 quotes issued", value: quotes.toString() },
  ];

  return (
    <div className="mt-8 space-y-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <p className="text-sm text-zinc-500">{s.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
          <h2 className="mb-4 font-semibold">Cash out</h2>
          <CashOutForm defaultEmail={publisher.paypalEmail ?? ""} balanceCents={publisher.balanceCents} minCents={MIN_PAYOUT_CENTS} />

          <h3 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500">Payout history</h3>
          {payouts.length === 0 ? (
            <p className="text-sm text-zinc-500">No payouts yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
              {payouts.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="tabular-nums font-medium">${(p.amountCents / 100).toFixed(2)}</span>
                    <span className="ml-2 truncate text-zinc-500">to {p.receiverEmail}</span>
                    {p.failureReason && <span className="block text-xs text-red-600">{p.failureReason}</span>}
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[p.status]}`} title={p.paypalStatus ?? ""}>
                    {p.status.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
          <h2 className="mb-4 font-semibold">Recent AI agent visits</h2>
          {visits.length === 0 ? (
            <p className="text-sm text-zinc-500">No bots yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
              {visits.map((v) => (
                <li key={v.id} className="flex justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{v.botName ?? "Unknown bot"}</span>
                    <span className="ml-2 text-zinc-500">{v.resource?.title ?? v.path}</span>
                  </span>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {v.outcome === "PAID_ACCESS" ? "paid" : v.outcome === "QUOTED" ? "got 402" : "free"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="mb-4 font-semibold">Articles</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-2 pr-4 font-medium">Article</th>
                <th className="py-2 pr-4 font-medium">Read</th>
                <th className="py-2 pr-4 font-medium">Train</th>
                <th className="py-2 font-medium">Paid reads</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {resources.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 pr-4">{r.title}</td>
                  <td className="py-2 pr-4 tabular-nums">{r.priceReadCents ? formatCents(r.priceReadCents) : "free"}</td>
                  <td className="py-2 pr-4 tabular-nums">{r.priceTrainCents ? formatCents(r.priceTrainCents) : "free"}</td>
                  <td className="py-2 tabular-nums">{r._count.grants}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
