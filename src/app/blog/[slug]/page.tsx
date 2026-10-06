import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArticleBody } from "@/components/article-body";
import { prisma } from "@/lib/db";
import { detectBot } from "@/lib/tollgate/bots";
import { recordVisit } from "@/lib/tollgate/service";
import { readTollgateToken, verifyAccessToken } from "@/lib/tollgate/token";

export default function ArticlePage({ params }: PageProps<"/blog/[slug]">) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/blog" className="text-sm text-emerald-600 hover:underline">
        ← The Grid Ledger
      </Link>
      <Suspense fallback={<p className="mt-6 text-zinc-500">Loading article…</p>}>
        <Article params={params} />
      </Suspense>
      <p className="mt-16 text-xs text-zinc-500">Fictional demo content for Tollgate.</p>
    </main>
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
    await recordVisit({
      path,
      userAgent: requestHeaders.get("user-agent") ?? "",
      botName: bot.isBot ? bot.botName : undefined,
      resourceId: resource.id,
      outcome: "PAID_ACCESS",
    });
  }

  return (
    <article>
      <h1 className="mt-4 text-4xl font-bold tracking-tight">{resource.title}</h1>
      <p className="mt-3 text-sm text-zinc-500">
        {resource.publishedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </p>
      <div className="mt-10">
        <ArticleBody body={resource.body} />
      </div>
    </article>
  );
}
