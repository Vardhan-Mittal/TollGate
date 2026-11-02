"use client";

import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Reveal } from "@/components/motion";
import { PaywallLab } from "./paywall-lab";

const STEPS: { title: string; text: string; Illustration: () => ReactNode }[] = [
  {
    title: "Detect",
    text: "Tollgate sits in front of your site. Humans read free; AI crawlers and agents are recognised by user-agent or a Tollgate-Agent header.",
    Illustration: DetectArt,
  },
  {
    title: "Quote",
    text: "Agents get HTTP 402 Payment Required with a price an AI set for that article, a license (read or train) and a teaser.",
    Illustration: QuoteArt,
  },
  {
    title: "Decide & pay",
    text: "The agent's own AI weighs the teaser against its budget, then pays from a wallet funded through PayPal.",
    Illustration: PayArt,
  },
  {
    title: "Settle",
    text: "The agent reads with a short-lived token. The publisher cashes out through PayPal Payouts or bills big AI customers by PayPal invoice.",
    Illustration: SettleArt,
  },
];

const pad = (i: number) => String(i + 1).padStart(2, "0");

/**
 * "How it works": four step headings that light up as the section scrolls past, or on
 * click / arrow keys, beside a card explaining the active step. Ends with the paywall lab (the 402 exchange and the gated article).
 */
export function HowItWorks({ className = "" }: { className?: string }) {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const lastScrollStep = useRef(-1);

  // Scroll picks the step only when its own answer changes, so a click isn't undone by the next pixel of scroll.
  const { scrollYProgress } = useScroll({ target: trackRef, offset: ["start 0.8", "end 0.4"] });
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const step = Math.min(STEPS.length - 1, Math.max(0, Math.floor(p * STEPS.length)));
    if (step !== lastScrollStep.current) {
      lastScrollStep.current = step;
      setActive(step);
    }
  });

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const delta = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (i + delta + STEPS.length) % STEPS.length;
    setActive(next);
    buttons.current[next]?.focus();
  }

  const step = STEPS[active];

  return (
    <section aria-labelledby="how-heading" className={`mt-16 overflow-x-clip ${className}`}>
      <Reveal>
        <h2 id="how-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
          From crawl to <span className="font-serif text-[1.08em] font-normal italic text-emerald-600">cash-out.</span>
        </h2>
        <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">How it works, in four steps and a few hundred milliseconds.</p>
      </Reveal>

      <div ref={trackRef} className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
        <ol className="flex flex-col gap-1 lg:gap-3" aria-label="Steps">
          {STEPS.map((s, i) => {
            const on = i === active;
            return (
              <li key={s.title}>
                <button
                  ref={(el) => {
                    buttons.current[i] = el;
                  }}
                  type="button"
                  aria-pressed={on}
                  aria-controls="how-panel"
                  onClick={() => setActive(i)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  className={`group flex items-start gap-1.5 rounded-md py-1 text-left text-3xl font-semibold tracking-tight outline-offset-4 focus-visible:outline-2 focus-visible:outline-emerald-500 sm:text-5xl ${
                    reduce ? "" : "transition-colors duration-300"
                  } ${on ? "text-zinc-950 dark:text-zinc-50" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
                >
                  {s.title}
                  <sup
                    aria-hidden
                    className={`mt-1 font-mono text-xs font-normal tracking-normal sm:mt-2 ${
                      on ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-500"
                    }`}
                  >
                    {pad(i)}
                  </sup>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
          {/* Progress: one segment per step. */}
          <div aria-hidden className="grid grid-cols-4 gap-1.5">
            {STEPS.map((s, i) => (
              <span
                key={s.title}
                className={`h-0.5 rounded-full ${reduce ? "" : "transition-colors duration-300"} ${
                  i <= active ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-800"
                }`}
              />
            ))}
          </div>

          <div id="how-panel" role="region" aria-live="polite" aria-atomic="true" aria-label="Active step" className="mt-5">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={reduce ? { duration: 0 } : { duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              >
                <div aria-hidden className="flex h-[150px] flex-col justify-center rounded-xl border border-zinc-200 bg-background px-4 font-mono text-[11px] leading-5 sm:text-xs dark:border-zinc-800">
                  <step.Illustration />
                </div>
                <p className="mt-5 font-mono text-xs uppercase tracking-widest text-zinc-500">
                  Step {pad(active)} · {step.title}
                </p>
                <p className="mt-1.5 text-zinc-700 dark:text-zinc-300">{step.text}</p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <Reveal>
        <PaywallLab className="mt-8" />
      </Reveal>
    </section>
  );
}

/* ---------- Step illustrations (decorative; the text carries the meaning) ---------- */

function Row({ left, right, accent = false }: { left: ReactNode; right: ReactNode; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-zinc-200 py-1.5 last:border-0 dark:border-zinc-800">
      <span className="truncate text-zinc-500">{left}</span>
      <span className={`shrink-0 ${accent ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-900 dark:text-zinc-100"}`}>{right}</span>
    </div>
  );
}

function DetectArt() {
  return (
    <>
      <Row left="Mozilla/5.0 … Safari/605" right="human · 200 free" />
      <Row left="GPTBot/1.2" right="AI crawler · gated" accent />
      <Row left="Tollgate-Agent: research-7" right="AI agent · gated" accent />
    </>
  );
}

function QuoteArt() {
  return (
    <>
      <p className="text-zinc-900 dark:text-zinc-100">
        HTTP/1.1 <span className="font-semibold">402</span> Payment Required
      </p>
      <p>
        <span className="rounded bg-emerald-500/10 px-1 text-emerald-700 dark:text-emerald-400">Tollgate-Price: 0.24 USD</span>
      </p>
      <p className="truncate text-zinc-500">license: read · train</p>
      <p className="truncate text-zinc-500">teaser: &ldquo;Proprietary pricing data from 40 suppliers…&rdquo;</p>
    </>
  );
}

function PayArt() {
  return (
    <>
      <div className="flex justify-between text-zinc-500">
        <span>budget $2.00</span>
        <span className="tabular-nums">spent $0.86</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className="h-full w-[43%] rounded-full bg-zinc-800 dark:bg-zinc-300" />
      </div>
      <p className="mt-3 text-zinc-900 dark:text-zinc-100">
        <span className="text-emerald-700 dark:text-emerald-400">pay $0.24</span> · fresh supplier data, worth it
      </p>
      <p className="text-zinc-500">POST /api/tollgate/pay · PayPal-funded wallet</p>
    </>
  );
}

function SettleArt() {
  return (
    <>
      <Row left="access_token" right="expires in 10 min" />
      <Row left="publisher balance" right="+$0.24" accent />
      <Row left="cash-out" right="PayPal Payouts" />
      <Row left="bulk AI customer" right="PayPal invoice" />
    </>
  );
}
