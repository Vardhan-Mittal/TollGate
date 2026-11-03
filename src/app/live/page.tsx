import { AgentConsole } from "@/app/agent/agent-console";
import { PageHeader, PageShell, ui } from "@/components/ui/kit";
import { PublisherFeed } from "./publisher-feed";
import { RunawayTest } from "./runaway-test";

export default function LivePage() {
  return (
    <PageShell width="7xl">
      <PageHeader
        eyebrow="Live"
        title="One agent, one publisher,"
        accent="settled on PayPal."
        description={
          <>
            Left: an AI research agent meets Tollgate&apos;s 402 quotes and decides what is worth paying for. Right: what the
            publisher sees, read from its own ledger as it happens.
          </>
        }
      />

      <div className="mt-10 grid gap-6 lg:grid-cols-2 lg:gap-8">
        <section aria-labelledby="live-buyer" className={`min-w-0 p-4 sm:p-6 ${ui.card}`}>
          <h2 id="live-buyer" className="mb-5 flex flex-wrap items-center gap-2.5 font-medium tracking-tight">
            <span className="rounded-full border border-zinc-200 px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600 dark:border-white/10 dark:text-zinc-400">
              Buyer
            </span>
            AI research agent
          </h2>
          <AgentConsole layout="stacked" />
          <RunawayTest />
        </section>

        <section aria-labelledby="live-seller" className={`min-w-0 p-4 sm:p-6 ${ui.card}`}>
          <h2 id="live-seller" className="mb-5 flex flex-wrap items-center gap-2.5 font-medium tracking-tight">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 motion-safe:animate-[pulse-dot_1.6s_ease-out_infinite]" />
              Seller
            </span>
            The Grid Ledger · publisher view
          </h2>
          <PublisherFeed />
        </section>
      </div>
    </PageShell>
  );
}
