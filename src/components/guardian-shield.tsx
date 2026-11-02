import Link from "next/link";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { GuardianShields } from "@/components/guardian-shield/shields";

const FACTS = [
  ["Scores every payment", "Each payment is weighed against the agent's own history: repeats, velocity, bursts, price outliers, odd hours."],
  ["Freezes at 75% risk", "The payment is held with HTTP 423, the wallet freezes and auto-recharge stops until a human steps in."],
  ["Explains itself", "An LLM writes the owner a plain-English note on what looked wrong and why."],
] as const;

/** Landing-page section for the Spend Guardian: a heading that passes behind frosted shields. */
export function GuardianSection() {
  return (
    <section id="guardian" aria-labelledby="guardian-heading" className="mt-16 overflow-x-clip">
      {/* No overflow-hidden here: a rounded overflow clip on an ancestor makes Chrome ignore the shields' clip-path. */}
      <div className="relative rounded-2xl border border-zinc-200 bg-zinc-50 px-5 pb-8 pt-12 sm:px-10 sm:pb-10 sm:pt-16 dark:border-zinc-800 dark:bg-zinc-950">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          {/* Texture for the glass to frost, fading out towards the edges. */}
          <div className="absolute inset-0 bg-[radial-gradient(circle,rgb(24_24_27/0.12)_1px,transparent_1px)] bg-size-[18px_18px] [mask-image:radial-gradient(ellipse_at_65%_30%,black,transparent_70%)] dark:bg-[radial-gradient(circle,rgb(255_255_255/0.1)_1px,transparent_1px)]" />
          <div className="absolute -top-16 right-0 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl sm:right-24 lg:right-48 dark:bg-emerald-500/10" />
        </div>

        <div className="relative">
          <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">Spend Guardian</p>
          <Reveal>
            <h2 id="guardian-heading" className="mt-4 max-w-3xl text-[2.6rem] font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Agents with wallets need a{" "}
              <span className="font-serif text-[1.08em] font-normal italic text-emerald-600">guardian.</span>
            </h2>
          </Reveal>
          {/* After the heading in the DOM, so the glass paints over "wallets" and frosts it. */}
          <GuardianShields className="pointer-events-none absolute -top-8 right-0 origin-top-right scale-[0.5] sm:-top-12 sm:right-2 sm:scale-75 lg:right-20 lg:scale-100" />
        </div>

        <Reveal delay={0.05} className="relative mt-6 max-w-md">
          <p className="text-zinc-600 dark:text-zinc-400">
            Like a card issuer&apos;s fraud check, every payment an agent makes is scored against its own habits. A runaway loop gets
            stopped before it drains the wallet.
          </p>
        </Reveal>

        <Stagger as="dl" className="relative mt-10 grid gap-6 border-t border-zinc-200 pt-6 sm:grid-cols-3 dark:border-zinc-800">
          {FACTS.map(([label, text]) => (
            <StaggerItem key={label}>
              <dt className="font-mono text-xs uppercase tracking-widest text-zinc-900 dark:text-zinc-100">{label}</dt>
              <dd className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{text}</dd>
            </StaggerItem>
          ))}
        </Stagger>

        <Link href="/live" className="group relative mt-8 inline-block text-sm font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-500 dark:hover:text-emerald-400">
          Try the runaway test <span aria-hidden className="inline-block transition-transform group-hover:translate-x-1">→</span>
        </Link>
      </div>
    </section>
  );
}
