import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArticleBody } from "@/components/article-body";
import { PageShell, ui } from "@/components/ui/kit";
import { prisma } from "@/lib/db";
import { detectBot } from "@/lib/tollgate/bots";
import { recordVisit } from "@/lib/tollgate/service";
import { readTollgateToken, verifyAccessToken } from "@/lib/tollgate/token";

export default function ArticlePage({ params }: PageProps<"/blog/[slug]">) {
  return (
    <PageShell width="3xl">
      <Link
        href="/blog"
        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white/60 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400 dark:hover:border-white/20 dark:hover:text-zinc-100"
      >
        ← The Grid Ledger
      </Link>
      <Suspense fallback={<p className={`mt-8 text-sm ${ui.muted}`}>Loading article…</p>}>
        <Article params={params} />
      </Suspense>
      <p className="mt-16 border-t border-zinc-200 pt-6 text-xs text-zinc-500 dark:border-white/10">Fictional demo content for Tollgate.</p>
    </PageShell>
  );
}

async function Article({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const path = `/blog/${slug}`;
  const resource = await prisma.resource.findUnique({ where: { path } });
  if (!resource) notFound();

  // The proxy already enforced payment. Here we only log paid agent reads.
  const requestHeaders = await headers();
  const token = readTollgateToken(requestHeaders);
  if (token && (await verifyAccessToken(token, path)).ok) {
    const bot = detectBot(requestHeaders);
    recordVisit({
      path,
      userAgent: requestHeaders.get("user-agent") ?? "",
      botName: bot.isBot ? bot.botName : undefined,
      resourceId: resource.id,
      outcome: "PAID_ACCESS",
    });
  }

  return (
    <article className="motion-safe:animate-rise">
      <h1 className="mt-6 text-3xl font-semibold leading-[1.1] tracking-[-0.03em] text-balance sm:text-[2.75rem]">
        <span className="text-sheen">{resource.title}</span>
      </h1>
      <p className={`mt-4 ${ui.label}`}>
        {resource.publishedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </p>
      <div className="mt-10 border-t border-zinc-200 pt-10 dark:border-white/10">
        <ArticleBody body={resource.body} />
      </div>
    </article>
  );
}
