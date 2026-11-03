import { Suspense } from "react";
import { PageHeader, PageShell, SectionLabel, ui } from "@/components/ui/kit";
import { prisma } from "@/lib/db";
import { DEAL_POLICY } from "@/lib/deals";
import { NegotiationConsole } from "./negotiation-console";

export default function DealsPage() {
  return (
    <PageShell width="4xl">
      <PageHeader
        eyebrow="Agent-to-agent commerce"
        title="Two AI agents negotiate"
        accent="a training license."
        description={
          <>
            An AI lab&apos;s agent wants to train on the publisher&apos;s archive. The publisher&apos;s agent defends a private floor (
            {DEAL_POLICY.floorPct}% of list). They bargain for up to {DEAL_POLICY.maxRounds} rounds. If they agree, the publisher&apos;s
            agent bills the buyer with a PayPal invoice through the PayPal Agent Toolkit, and paying it activates the license.
          </>
        }
      />
      <Suspense fallback={<p className="mt-10 text-sm text-zinc-500">Loading…</p>}>
        <Deals />
      </Suspense>
    </PageShell>
  );
}

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

// Status chips in the landing live board's tones: emerald once paid, amber while an invoice is open, red on failure.
const STATUS_TONE: Record<string, string> = {
  PAID: "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  INVOICED: "bg-amber-500/12 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  FAILED: "bg-red-500/12 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};
const MUTED_TONE = "bg-zinc-500/10 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300";

async function Deals() {
  const [resources, deals] = await Promise.all([
    prisma.resource.findMany({ where: { priceTrainCents: { gt: 0 } } }),
    prisma.deal.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { agent: true } }),
  ]);
  const listPriceCents = resources.reduce((s, r) => s + r.priceTrainCents, 0);

  return (
    <>
      <NegotiationConsole listPriceCents={listPriceCents} />

      <section className="mt-16">
        <SectionLabel>Recent deals</SectionLabel>
        {deals.length === 0 ? (
          <p className={`p-5 text-sm text-zinc-500 ${ui.card}`}>No negotiations yet.</p>
        ) : (
          <ul className={`divide-y divide-zinc-200/70 text-sm dark:divide-white/[0.06] ${ui.card}`}>
            {deals.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
                <span className="min-w-0 tabular-nums">
                  {d.agent.name} · {d.resourceIds.length} articles · list {usd(d.listPriceCents)}
                  {d.agreedPriceCents != null && <span className="font-medium text-emerald-700 dark:text-emerald-400"> → {usd(d.agreedPriceCents)}</span>}
                </span>
                <span className="flex items-center gap-3">
                  {d.status === "INVOICED" && d.invoiceUrl && (
                    <a
                      href={d.invoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-700 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
                    >
                      Pay invoice ↗
                    </a>
                  )}
                  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[d.status] ?? MUTED_TONE}`}>
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
