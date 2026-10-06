import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/money";

export default function BlogIndex() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-10 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-600">Demo publisher</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">The Grid Ledger</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Free for humans. AI agents pay per article through Tollgate.
        </p>
      </header>

      <Suspense fallback={<p className="text-zinc-500">Loading articles…</p>}>
        <ArticleList />
      </Suspense>

      <p className="mt-12 text-xs text-zinc-500">
        All articles, companies and figures on this demo site are fictional and exist only to demonstrate Tollgate.
      </p>
    </main>
  );
}

async function ArticleList() {
  const resources = await prisma.resource.findMany({ orderBy: { publishedAt: "desc" } });

  return (
    <ul className="space-y-6">
      {resources.map((r) => (
        <li key={r.id} className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <Link href={r.path} className="text-lg font-semibold hover:underline">
            {r.title}
          </Link>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">{r.description}</p>
          <p className="mt-3 text-sm text-zinc-500">
            AI price:{" "}
            {r.priceReadCents === 0 ? (
              <span className="font-medium text-emerald-600">free</span>
            ) : (
              <>
                <span className="font-medium">{formatCents(r.priceReadCents)}</span> to read ·{" "}
                <span className="font-medium">{formatCents(r.priceTrainCents)}</span> to train
              </>
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}
