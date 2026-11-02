import Link from "next/link";
import { Suspense } from "react";
import { LiveBoard, LiveBoardSkeleton } from "@/components/live-board/live-board";
import { GuardianSection } from "@/components/guardian-shield";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { HowItWorks } from "@/components/landing/how-it-works";
import { PublisherCta } from "@/components/landing/publisher-cta";
import { CountUp, Lift, Reveal, Stagger, StaggerItem } from "@/components/motion";
import { PaymentFlow } from "@/components/payment-flow";
import { prisma } from "@/lib/db";
import { accounts } from "@/lib/tollgate/service";

const IMPACT = [
  {
    stat: "1,091 : 1",
    text: "Pages OpenAI's crawlers fetched for every visitor they sent back to a site in July 2025. Google Search: 14 : 1.",
    source: "Cloudflare",
    href: "https://blog.cloudflare.com/crawlers-click-ai-bots-training/",
  },
  {
    stat: "8% vs 15%",
    text: "How often people click a result when Google shows an AI summary, versus when it doesn't. Only 1% click the summary's sources.",
    source: "Pew Research Center",
    href: "https://www.theregister.com/2025/07/22/google_ai_overviews_suppress_search/",
  },
];

const DEMOS = [
  { href: "/live", title: "Live: agent and publisher side by side", text: "Watch an AI pay and the publisher earn, in real time." },
  { href: "/deals", title: "Two AI agents negotiate a deal", text: "A bulk training license, bargained by AI and settled by PayPal invoice." },
  { href: "/agent", title: "Run the research agent", text: "Watch an AI decide what is worth paying for." },
  { href: "/dashboard", title: "Publisher dashboard", text: "AI pricing, traffic, payouts and the finance assistant." },
  { href: "/wallet", title: "Agent wallet", text: "Top up with PayPal and turn on auto-recharge." },
  { href: "/blog", title: "Demo publisher", text: "A fictional energy newsletter protected by Tollgate." },
];

export default function Home() {
  return (
    <main className="relative mx-auto w-full max-w-5xl overflow-x-clip px-4 py-14">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/3 -z-10 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl motion-safe:animate-[drift_14s_ease-in-out_infinite] dark:bg-emerald-500/15"
      />
      {/* The hero uses a CSS entrance, not <Reveal>: it must be visible on first paint, with or without JavaScript. */}
      <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-emerald-600 motion-safe:animate-rise">
        <span className="h-2 w-2 rounded-full bg-emerald-500 motion-safe:animate-[pulse-dot_1.6s_ease-out_infinite]" />
        Tollgate
      </p>
      <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight [animation-delay:80ms] motion-safe:animate-rise sm:text-6xl">
        AI agents pay{" "}
        <span className="font-serif text-[1.08em] font-normal italic text-emerald-600 sm:block sm:whitespace-nowrap">the web they read.</span>
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-zinc-600 [animation-delay:160ms] motion-safe:animate-rise dark:text-zinc-400">
        AI crawlers and agents read millions of pages, and the people who wrote them get almost nothing back. Tollgate is an open HTTP
        402 paywall for machines: creators set the rules, AI sets the price, agents decide what is worth buying, and everyone settles
        on PayPal.
      </p>

      <PaymentFlow />

      {/* Near the fold on most screens, so these use the CSS entrance too. */}
      <div className="mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
        {IMPACT.map((item, i) => (
          <div key={item.stat} style={{ animationDelay: `${520 + i * 90}ms` }} className="motion-safe:animate-rise">
            <Lift>
              <a
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl border border-zinc-200 p-4 transition-colors hover:border-emerald-500 dark:border-zinc-800"
              >
                <p className="text-3xl font-bold tabular-nums">{item.stat}</p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{item.text}</p>
                <p className="mt-2 text-xs text-zinc-500">Source: {item.source} ↗</p>
              </a>
            </Lift>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/live" className="rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-700">
          Watch an agent pay
        </Link>
        <Link href="/dashboard" className="rounded-lg border border-zinc-300 px-5 py-2.5 font-medium dark:border-zinc-700">
          See what publishers earn
        </Link>
      </div>

      <Suspense fallback={<div className="mt-12 h-24" />}>
        <LiveStats />
      </Suspense>

      <section className="mt-20 overflow-x-clip pb-2">
        <Reveal>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Every AI visit, <span className="font-serif text-[1.08em] font-normal italic text-emerald-600">on the record.</span>
          </h2>
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <p className="text-zinc-600 dark:text-zinc-400">Real traffic from the demo publisher. Filter it.</p>
            <Link href="/dashboard" className="group text-sm font-medium text-emerald-600 hover:text-emerald-700">
              Open the publisher dashboard <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </Reveal>
        <Suspense fallback={<LiveBoardSkeleton />}>
          <LiveBoard />
        </Suspense>
      </section>

      <HowItWorks />

      <GuardianSection />

      <FeatureGrid />

      <PublisherCta />

      <section className="mt-16">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight">Try the demo</h2>
        </Reveal>
        <Stagger className="mt-6 grid gap-4 sm:grid-cols-2">
          {DEMOS.map((d) => (
            <StaggerItem key={d.href}>
              <Lift>
                <Link href={d.href} className="group block rounded-xl border border-zinc-200 p-5 transition-colors hover:border-emerald-500 dark:border-zinc-800">
                  <p className="font-semibold">
                    {d.title} <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">{d.text}</p>
                </Link>
              </Lift>
            </StaggerItem>
          ))}
        </Stagger>
        <p className="mt-6 text-xs text-zinc-500">
          Runs entirely on the PayPal sandbox: no real money moves. The demo publisher and its articles are fictional.
        </p>
      </section>
    </main>
  );
}

async function LiveStats() {
  // A database hiccup shouldn't take down the first page a visitor sees.
  const counts = await Promise.all([
    prisma.accessGrant.count(),
    prisma.botVisit.count({ where: { outcome: "QUOTED" } }),
    // Real publishers only: the Guardian simulation books its test purchases to its own account.
    prisma.ledgerEntry.aggregate({ _sum: { amountCents: true }, where: { kind: "EARNING", account: { not: accounts.simulation } } }),
    prisma.agent.count(),
  ]).catch((err) => {
    console.error("live stats unavailable", err);
    return null;
  });
  if (!counts) {
    return <p className="mt-12 text-sm text-zinc-500">Live numbers are unavailable right now. The demos below still work.</p>;
  }
  const [paidReads, quotes, paidOut, agents] = counts;

  const stats = [
    { label: "paid AI reads", value: paidReads },
    { label: "402 quotes issued", value: quotes },
    { label: "earned by publishers", value: (paidOut._sum.amountCents ?? 0) / 100, prefix: "$", decimals: 2 },
    { label: "agents with wallets", value: agents },
  ];

  return (
    <Stagger as="dl" className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((s) => (
        <StaggerItem key={s.label} className="rounded-xl bg-zinc-100 p-4 dark:bg-zinc-900">
          <dt className="text-xs uppercase tracking-wide text-zinc-500">{s.label}</dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums">
            <CountUp value={s.value} prefix={s.prefix} decimals={s.decimals} />
          </dd>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
