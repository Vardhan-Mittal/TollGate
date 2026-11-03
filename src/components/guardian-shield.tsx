import Link from "next/link";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { GuardianShields } from "@/components/guardian-shield/shields";
import { ui } from "@/components/ui/kit";

const FACTS = [
  ["Scores every payment", "Each payment is weighed against the agent's own history: repeats, velocity, bursts, price outliers, odd hours."],
  ["Freezes at 75% risk", "The payment is held with HTTP 423, the wallet freezes and auto-recharge stops until a human steps in."],
  ["Explains itself", "An LLM writes the owner a plain-English note on what looked wrong and why."],
] as const;

/** Landing-page section for the Spend Guardian: the copy on the left, layered glass shields in their own column. */
export function GuardianSection() {
  return (
    <section id="guardian" aria-labelledby="guardian-heading" className="mt-16 overflow-x-clip">
      {/* No overflow-hidden here: a rounded overflow clip on an ancestor makes Chrome ignore the shields' clip-path. */}
      <div className={`relative px-5 pb-8 pt-10 sm:px-10 sm:pb-10 sm:pt-14 ${ui.card}`}>
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <p className={ui.label}>Spend Guardian</p>
            <Reveal>
              <h2 id="guardian-heading" className="mt-4 text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-balance sm:text-5xl lg:text-6xl">
                <span className="text-sheen">Agents with wallets need a </span>
                <span className="font-serif text-[1.08em] font-normal italic tracking-[-0.01em] text-emerald-600 dark:text-emerald-400">
                  guardian.
                </span>
              </h2>
            </Reveal>
            <Reveal delay={0.05} className="mt-5 max-w-lg">
              <p className={ui.muted}>
                Like a card issuer&apos;s fraud check, every payment an agent makes is scored against its own habits. A runaway loop gets
                stopped before it drains the wallet.
              </p>
            </Reveal>
            <Link href="/live" className={`group mt-7 ${ui.btnSecondary}`}>
              Try the runaway test <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </div>

          {/* Its own column, so the glass only frosts the faint dot texture behind it, never the text. */}
          <div aria-hidden className="relative hidden h-[330px] sm:block">
            <div className="absolute inset-0 bg-[radial-gradient(circle,rgb(24_24_27/0.10)_1px,transparent_1px)] bg-size-[18px_18px] [mask-image:radial-gradient(ellipse_at_50%_45%,black,transparent_70%)] dark:bg-[radial-gradient(circle,rgb(255_255_255/0.08)_1px,transparent_1px)]" />
            <GuardianShields className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-90" />
          </div>
        </div>

        <Stagger as="dl" className="mt-10 grid gap-6 border-t border-zinc-200 pt-6 sm:grid-cols-3 dark:border-white/10">
          {FACTS.map(([label, text]) => (
            <StaggerItem key={label}>
              <dt className="font-mono text-xs uppercase tracking-widest text-zinc-900 dark:text-zinc-100">{label}</dt>
              <dd className={`mt-2 text-sm ${ui.muted}`}>{text}</dd>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
