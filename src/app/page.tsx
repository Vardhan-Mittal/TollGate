import Link from "next/link";
import { Suspense } from "react";
import { LiveBoard, LiveBoardSkeleton } from "@/components/live-board/live-board";
import { GuardianSection } from "@/components/guardian-shield";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Faq } from "@/components/landing/faq";
import { Gate3D } from "@/components/landing/gate-3d";
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
      {/* Quiet backdrop: a fading dot grid and a faint spotlight from above, nothing coloured behind the text. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-[640px] bg-dot-grid" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[420px] w-[820px] max-w-[160vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(24_24_27/0.06),transparent)] blur-2xl dark:bg-[radial-gradient(closest-side,rgb(255_255_255/0.06),transparent)]"
      />

      {/* The hero uses a CSS entrance, not <Reveal>: it must be visible on first paint, with or without JavaScript. */}
      <div className="flex flex-col items-center pt-6 text-center sm:pt-10">
        <Link
          href="/live"
          className="group inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/60 py-1 pl-1 pr-3 text-sm text-zinc-600 backdrop-blur transition-colors hover:border-zinc-300 motion-safe:animate-rise dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400 dark:hover:border-white/20"
        >
          <span className="flex items-center gap-1.5 rounded-full border border-zinc-200 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-emerald-700 dark:border-white/10 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 motion-safe:animate-[pulse-dot_1.6s_ease-out_infinite]" />
            Live
          </span>
          AI agents paying on the <span className="text-zinc-900 dark:text-zinc-100">PayPal sandbox</span>
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
        <h1 className="mt-6 text-5xl font-semibold leading-[1.02] tracking-[-0.04em] [animation-delay:80ms] motion-safe:animate-rise sm:text-7xl">
          <span className="text-sheen">AI agents pay</span>
          <br />
          <span className="text-zinc-400 dark:text-zinc-500">the web they </span>
          <span className="font-serif text-[1.1em] font-normal italic tracking-[-0.01em] text-emerald-600 dark:text-emerald-400">read.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-pretty text-zinc-600 [animation-delay:160ms] motion-safe:animate-rise dark:text-zinc-400">
          An open HTTP 402 paywall for machines. Creators set the rules, AI sets the price, agents decide what is worth buying, and
          everyone settles on PayPal.
        </p>
        <div className="mt-8 flex [animation-delay:240ms] motion-safe:animate-rise flex-wrap justify-center gap-3">
          <Link
            href="/live"
            className="group inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3 font-medium text-white shadow-[0_8px_24px_rgb(0_0_0/0.18)] transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:shadow-[0_0_32px_rgb(255_255_255/0.12)] dark:hover:bg-white"
          >
            Watch an agent pay <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-zinc-200 bg-white/60 px-6 py-3 font-medium transition-colors hover:border-zinc-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20"
          >
            See what publishers earn
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-3xl">
        <Gate3D className="mt-6" label="Illustration: a toll gate that opens when a payment arrives" />
        <PaymentFlow />
      </div>

      {/* Near the fold on most screens, so these use the CSS entrance too. */}
      <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
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

      <Faq className="mt-24" />
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
