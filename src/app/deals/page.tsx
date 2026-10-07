import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { DEAL_POLICY } from "@/lib/deals";
import { NegotiationConsole } from "./negotiation-console";

export default function DealsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-widest text-emerald-600">Agent-to-agent commerce</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Two AI agents negotiate a training license.</h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">
        An AI lab&apos;s agent wants to train on the publisher&apos;s archive. The publisher&apos;s agent defends a private floor (
        {DEAL_POLICY.floorPct}% of list). They bargain for up to {DEAL_POLICY.maxRounds} rounds. If they agree, the publisher&apos;s
        agent bills the buyer with a PayPal invoice through the PayPal Agent Toolkit, and paying it activates the license.
      </p>
      <Suspense fallback={<p className="mt-8 text-zinc-500">Loading…</p>}>
        <Deals />
      </Suspense>
    </main>
  );
}

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

async function Deals() {
  const [resources, deals] = await Promise.all([
    prisma.resource.findMany({ where: { priceTrainCents: { gt: 0 } } }),
    prisma.deal.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { agent: true } }),
  ]);
  const listPriceCents = resources.reduce((s, r) => s + r.priceTrainCents, 0);

  return (
    <>
      <NegotiationConsole listPriceCents={listPriceCents} />

      <section className="mt-12">
        <h2 className="font-semibold">Recent deals</h2>
        {deals.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No negotiations yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
            {deals.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span>
                  {d.agent.name} · {d.resourceIds.length} articles · list {usd(d.listPriceCents)}
                  {d.agreedPriceCents != null && <span className="font-semibold"> → {usd(d.agreedPriceCents)}</span>}
                </span>
                <span className="flex items-center gap-3">
                  {d.status === "INVOICED" && d.invoiceUrl && (
                    <a href={d.invoiceUrl} target="_blank" rel="noreferrer" className="text-emerald-700 underline dark:text-emerald-400">
                      Pay invoice ↗
                    </a>
                  )}
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
                    {d.status.toLowerCase().replace("_", " ")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
