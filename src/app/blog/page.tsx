import Link from "next/link";
import { Suspense } from "react";
import { PageHeader, PageShell, ui } from "@/components/ui/kit";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/money";

export default function BlogIndex() {
  return (
    <PageShell width="3xl">
      <PageHeader
        eyebrow="Demo publisher"
        title="The Grid"
        accent="Ledger."
        description="A fictional energy newsletter, protected by Tollgate."
      />

      <p className={`${ui.inset} mt-8 flex items-center gap-2.5 px-4 py-3 text-sm ${ui.muted}`}>
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
        Free for humans. AI agents pay per article through Tollgate.
      </p>

      <Suspense fallback={<p className={`mt-10 text-sm ${ui.muted}`}>Loading articles…</p>}>
        <ArticleList />
      </Suspense>

      <p className="mt-14 text-xs text-pretty text-zinc-500">
        All articles, companies and figures on this demo site are fictional and exist only to demonstrate Tollgate.
      </p>
    </PageShell>
  );
}

async function ArticleList() {
  const resources = await prisma.resource.findMany({ orderBy: { publishedAt: "desc" } });

  return (
    <ul className="mt-10 flex flex-col gap-3">
      {resources.map((r) => (
        <li
          key={r.id}
          className={`${ui.card} group relative p-5 transition-colors hover:border-zinc-300 sm:p-6 dark:hover:border-white/20`}
        >
          <div className="flex items-start justify-between gap-4">
            {/* The title is the link; its overlay makes the whole card clickable. */}
            <Link
              href={r.path}
              className="text-lg font-semibold tracking-tight text-pretty after:absolute after:inset-0 after:rounded-2xl group-hover:underline group-hover:decoration-zinc-300 group-hover:underline-offset-4 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-emerald-500/40 dark:group-hover:decoration-zinc-600"
            >
              {r.title}
            </Link>
            <span aria-hidden className="mt-1 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </div>
          <p className={`mt-1.5 text-pretty ${ui.muted}`}>{r.description}</p>
          <p className="mt-4 font-mono text-xs text-zinc-500">
            AI price:{" "}
            {r.priceReadCents === 0 ? (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">free</span>
            ) : (
              <>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatCents(r.priceReadCents)}</span> to read ·{" "}
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatCents(r.priceTrainCents)}</span> to train
              </>
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}
