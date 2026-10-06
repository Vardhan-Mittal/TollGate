import Link from "next/link";

const STEPS = [
  ["Detect", "AI agents are recognised by user-agent or a Tollgate-Agent header. Humans read free."],
  ["Quote", "Agents get HTTP 402 Payment Required with a price, a license and an AI-written teaser."],
  ["Pay", "The agent pays from a wallet funded with PayPal and receives a short-lived access token."],
  ["Read", "It retries with the token and gets the content. Publishers cash out with PayPal Payouts."],
];

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <p className="text-sm font-medium uppercase tracking-widest text-emerald-600">Tollgate</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">AI agents pay the web they read.</h1>
      <p className="mt-5 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
        An HTTP 402 paywall for AI crawlers and agents, settled on PayPal. Creators set the rules, AI sets the price,
        and agents decide what is worth paying for.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/blog" className="rounded-lg bg-zinc-900 px-5 py-2.5 font-medium text-white dark:bg-white dark:text-zinc-900">
          Open the demo publisher
        </Link>
        <Link
          href="/.well-known/tollgate.json"
          className="rounded-lg border border-zinc-300 px-5 py-2.5 font-medium dark:border-zinc-700"
        >
          Protocol discovery file
        </Link>
      </div>

      <ol className="mt-14 grid gap-4 sm:grid-cols-2">
        {STEPS.map(([title, text], i) => (
          <li key={title} className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <p className="text-sm text-zinc-500">Step {i + 1}</p>
            <p className="mt-1 text-lg font-semibold">{title}</p>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">{text}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}
