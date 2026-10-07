import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db";

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

const STEPS = [
  {
    title: "Detect",
    text: "Tollgate sits in front of your site. Humans read free; AI crawlers and agents are recognised by user-agent or a Tollgate-Agent header.",
  },
  {
    title: "Quote",
    text: "Agents get HTTP 402 Payment Required with a price an AI set for that article, a license (read or train) and a teaser.",
  },
  {
    title: "Decide & pay",
    text: "The agent's own AI weighs the teaser against its budget, then pays from a wallet funded through PayPal.",
  },
  {
    title: "Settle",
    text: "The agent reads with a short-lived token. The publisher cashes out through PayPal Payouts or bills big AI customers by PayPal invoice.",
  },
];

const PAYPAL = [
  ["Orders v2 + JS SDK v6", "Agent owners top up wallets with the PayPal button"],
  ["Vault (saved PayPal)", "Wallets auto-recharge with no human present"],
  ["Payouts", "Publishers cash out their AI earnings"],
  ["Agent Toolkit", "Agents create and send PayPal invoices for licenses and billing"],
  ["Invoicing webhooks", "Paying a license invoice activates it automatically"],
  ["Webhooks", "Signed, de-duplicated payment confirmations"],
];

const AI = [
  ["Seller-side pricing", "Gemini appraises freshness, originality, depth and scarcity, and prices each article within the publisher's limits."],
  ["Buyer-side agent", "A research agent reads each 402 quote and decides pay or skip, with a reason, under a hard budget."],
  ["Agent-to-agent deals", "A buyer agent and the publisher's agent negotiate a bulk training license under private limits, then settle by PayPal invoice."],
  ["Finance assistant", "Answers earnings questions, cashes out and invoices, and waits for a human yes before moving money."],
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
    <main className="mx-auto w-full max-w-5xl px-4 py-14">
      <p className="text-sm font-medium uppercase tracking-widest text-emerald-600">Tollgate</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">AI agents pay the web they read.</h1>
      <p className="mt-6 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
        AI crawlers and agents read millions of pages, and the people who wrote them get almost nothing back. Tollgate is an open HTTP
        402 paywall for machines: creators set the rules, AI sets the price, agents decide what is worth buying, and everyone settles
        on PayPal.
      </p>

      <div className="mt-8 grid max-w-3xl gap-4 sm:grid-cols-2">
        {IMPACT.map((item) => (
          <a
            key={item.stat}
            href={item.href}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-zinc-200 p-4 transition hover:border-emerald-500 dark:border-zinc-800"
          >
            <p className="text-3xl font-bold tabular-nums">{item.stat}</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{item.text}</p>
            <p className="mt-2 text-xs text-zinc-500">Source: {item.source} ↗</p>
          </a>
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

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
              <p className="text-sm text-zinc-500">Step {i + 1}</p>
              <p className="mt-1 text-lg font-semibold">{step.title}</p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{step.text}</p>
            </li>
          ))}
        </ol>
        <pre className="mt-6 overflow-x-auto rounded-xl bg-zinc-950 p-5 text-sm leading-6 text-zinc-100">
{`$ curl -i -A "GPTBot" https://<this-site>/blog/q3-2026-battery-cell-price-survey
HTTP/1.1 402 Payment Required
Tollgate-Price: 0.24 USD
{ "quote_id": "…", "license": "read", "teaser": "Proprietary pricing data from 40 suppliers…",
  "pay_url": "https://<this-site>/api/tollgate/pay" }`}
        </pre>
      </section>

      <section className="mt-16 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Built on PayPal</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Paying a few cents per page by card would cost more in fees than the payment itself. Tollgate pools agent spending in
            PayPal-funded wallets and settles publishers in batches.
          </p>
          <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
            {PAYPAL.map(([name, use]) => (
              <li key={name} className="flex justify-between gap-4 py-2.5 text-sm">
                <span className="font-medium">{name}</span>
                <span className="text-right text-zinc-500">{use}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">AI on both sides</h2>
          <ul className="mt-4 space-y-4">
            {AI.map(([name, text]) => (
              <li key={name}>
                <p className="font-medium">{name}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">Try the demo</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {DEMOS.map((d) => (
            <Link key={d.href} href={d.href} className="rounded-xl border border-zinc-200 p-5 transition hover:border-emerald-500 dark:border-zinc-800">
              <p className="font-semibold">{d.title} →</p>
              <p className="mt-1 text-sm text-zinc-500">{d.text}</p>
            </Link>
          ))}
        </div>
        <p className="mt-6 text-xs text-zinc-500">
          Runs entirely on the PayPal sandbox: no real money moves. The demo publisher and its articles are fictional.
        </p>
      </section>
    </main>
  );
}

async function LiveStats() {
  const [paidReads, quotes, paidOut, agents] = await Promise.all([
    prisma.accessGrant.count(),
    prisma.quote.count(),
    prisma.ledgerEntry.aggregate({ _sum: { amountCents: true }, where: { kind: "EARNING" } }),
    prisma.agent.count(),
  ]);

  const stats = [
    { label: "paid AI reads", value: paidReads.toLocaleString("en-US") },
    { label: "402 quotes issued", value: quotes.toLocaleString("en-US") },
    { label: "earned by publishers", value: `$${((paidOut._sum.amountCents ?? 0) / 100).toFixed(2)}` },
    { label: "agents with wallets", value: agents.toLocaleString("en-US") },
  ];

  return (
    <dl className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl bg-zinc-100 p-4 dark:bg-zinc-900">
          <dt className="text-xs uppercase tracking-wide text-zinc-500">{s.label}</dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}
