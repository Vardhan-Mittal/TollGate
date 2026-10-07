import { AgentConsole } from "@/app/agent/agent-console";
import { PublisherFeed } from "./publisher-feed";

export default function LivePage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10">
      <p className="text-sm font-medium uppercase tracking-widest text-emerald-600">Live</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">One AI agent. One publisher. Settled on PayPal.</h1>
      <p className="mt-2 max-w-3xl text-zinc-600 dark:text-zinc-400">
        Left: an AI research agent meets Tollgate&apos;s 402 quotes and decides what is worth paying for. Right: what the publisher
        sees, read from its own ledger as it happens.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section className="min-w-0 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs text-white dark:bg-white dark:text-zinc-900">Buyer</span>
            AI research agent
          </h2>
          <AgentConsole layout="stacked" />
        </section>

        <section className="min-w-0 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs text-white">Seller</span>
            The Grid Ledger · publisher view
          </h2>
          <PublisherFeed />
        </section>
      </div>
    </main>
  );
}
