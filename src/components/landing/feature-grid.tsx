"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef, type ReactNode, type RefObject } from "react";
import { Reveal } from "@/components/motion";
import { useLoop } from "./use-loop";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const PAYPAL_APIS = ["Orders v2 + JS SDK v6", "Vault", "Payouts", "Agent Toolkit invoicing", "Webhooks"];

type Feature = { title: string; text: string; tag: string; Illustration: () => ReactNode };

const FEATURES: Feature[] = [
  {
    title: "402 in one header",
    text: "AI agents get HTTP 402 Payment Required with a price, a licence and a teaser. Humans still read free.",
    tag: "HTTP 402 · Tollgate-Price",
    Illustration: HeaderIllustration,
  },
  {
    title: "AI sets the price",
    text: "Gemini scores each article for freshness, originality, depth and scarcity, then prices it within your limits.",
    tag: "Gemini",
    Illustration: PriceIllustration,
  },
  {
    title: "The agent decides",
    text: "The buyer's own AI weighs the teaser against a hard budget and pays or skips, with a stated reason.",
    tag: "Buyer agent",
    Illustration: DecideIllustration,
  },
  {
    title: "Wallets refill themselves",
    text: "Owners top up with the PayPal button; saved PayPal recharges the wallet when it runs low, with no human present.",
    tag: "PayPal Orders v2 · Vault",
    Illustration: WalletIllustration,
  },
  {
    title: "Cash out with PayPal",
    text: "Publishers send their AI earnings to PayPal in one batch instead of paying a card fee on every 24-cent read.",
    tag: "PayPal Payouts",
    Illustration: PayoutIllustration,
  },
  {
    title: "Agents negotiate licences",
    text: "A buyer agent and the publisher's agent bargain a bulk training licence under private limits, then settle by PayPal invoice.",
    tag: "PayPal Agent Toolkit · Invoicing",
    Illustration: NegotiateIllustration,
  },
];

/** "Every cent, accounted for": six feature cards, each with a small looping illustration of the real mechanism. */
export function FeatureGrid({ className = "" }: { className?: string }) {
  return (
    <section aria-labelledby="features-heading" className={`mt-16 overflow-x-clip ${className}`}>
      <Reveal>
        <h2 id="features-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
          Every cent, <span className="font-serif text-[1.08em] font-normal italic text-emerald-600">accounted for.</span>
        </h2>
        <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Paying a few cents per page by card would cost more in fees than the payment itself. Tollgate pools agent spending in
          PayPal-funded wallets, lets AI price and buy on both sides, and settles publishers in batches.
        </p>
      </Reveal>

      <Reveal delay={0.05}>
        {/* Hairline grid: the 1px gaps show the border colour behind the cells. */}
        <ul className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-800">
          {FEATURES.map(({ title, text, tag, Illustration }) => (
            <li key={title} className="flex flex-col bg-background">
              <Illustration />
              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-semibold tracking-tight">{title}</h3>
                <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">{text}</p>
                <p className="mt-auto pt-4 font-mono text-[11px] uppercase tracking-wider text-zinc-500">{tag}</p>
              </div>
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal delay={0.1} className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <span className="font-medium">Built on PayPal</span>
        {PAYPAL_APIS.map((api) => (
          <span
            key={api}
            className="rounded-full border border-zinc-200 px-2.5 py-0.5 font-mono text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
          >
            {api}
          </span>
        ))}
      </Reveal>
    </section>
  );
}

/* ---------- Shared pieces ---------- */

function Stage({ stageRef, children, className = "" }: { stageRef: RefObject<HTMLDivElement | null>; children: ReactNode; className?: string }) {
  return (
    <div
      ref={stageRef}
      aria-hidden
      className={`relative h-[140px] overflow-hidden border-b border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/40 ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgb(24_24_27/0.07)_1px,transparent_1px)] bg-size-[14px_14px] dark:bg-[radial-gradient(circle,rgb(255_255_255/0.06)_1px,transparent_1px)]" />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

/** Text that types itself in when `show` turns on, and clears instantly when it turns off. */
function TypeLine({ show, chars, ms = 700, className = "", children }: { show: boolean; chars: number; ms?: number; className?: string; children: ReactNode }) {
  return (
    <div
      className={`whitespace-nowrap ${className}`}
      style={{
        clipPath: show ? "inset(0 0 0 0)" : "inset(0 100% 0 0)",
        transition: show ? `clip-path ${ms}ms steps(${chars}, end)` : "none",
      }}
    >
      {children}
    </div>
  );
}

/** Fades and lifts in on `show`; snaps away when it turns off so the loop restarts cleanly. */
function Appear({ show, delay = 0, className = "", children }: { show: boolean; delay?: number; className?: string; children: ReactNode }) {
  return (
    <motion.div
      className={className}
      initial={false}
      animate={show ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 6, scale: 0.97 }}
      transition={show ? { duration: 0.35, ease: EASE_OUT, delay } : { duration: 0 }}
    >
      {children}
    </motion.div>
  );
}

/** A number that rolls to its new value. */
function Rolling({ value, className = "" }: { value: string; className?: string }) {
  return (
    <span className={`relative inline-flex overflow-hidden tabular-nums ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: "60%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-60%", opacity: 0 }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

const money = (n: number) => `$${n.toFixed(2)}`;

/* ---------- 1. 402 in one header ---------- */

const HEADER_PHASES = [500, 1000, 700, 2800] as const;

function HeaderIllustration() {
  const ref = useRef<HTMLDivElement>(null);
  const phase = useLoop(ref, HEADER_PHASES);
  return (
    <Stage stageRef={ref}>
      <div className="flex h-full flex-col justify-center gap-1 font-mono text-[11px] leading-5 sm:text-xs">
        <TypeLine show={phase >= 1} chars={26} className="text-zinc-500">
          <span className="text-zinc-400">→ </span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">GET</span> /blog/q3-battery-survey
        </TypeLine>
        <TypeLine show={phase >= 1} chars={18} className="text-zinc-500">
          <span className="text-zinc-400">  </span>User-Agent: GPTBot
        </TypeLine>
        <Appear show={phase >= 2} className="mt-1 text-zinc-900 dark:text-zinc-100">
          <span className="text-zinc-400">← </span>
          <span className="font-semibold">402</span> Payment Required
        </Appear>
        <TypeLine show={phase >= 3} chars={26} ms={800}>
          <span className="text-zinc-400">  </span>
          <span className="rounded bg-emerald-500/10 px-1 text-emerald-700 dark:text-emerald-400">Tollgate-Price: 0.24 USD</span>
        </TypeLine>
      </div>
    </Stage>
  );
}

/* ---------- 2. AI sets the price ---------- */

const PRICE_PHASES = [500, 1500, 2800] as const;
const SCORES = [
  ["freshness", 0.86],
  ["originality", 0.62],
  ["depth", 0.74],
  ["scarcity", 0.91],
] as const;

function PriceIllustration() {
  const ref = useRef<HTMLDivElement>(null);
  const phase = useLoop(ref, PRICE_PHASES);
  return (
    <Stage stageRef={ref}>
      <div className="flex h-full items-center gap-4">
        <div className="flex-1 space-y-2.5 font-mono text-[10px] text-zinc-500">
          {SCORES.map(([label, score], i) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-[4.5rem] shrink-0">{label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <motion.span
                  className="block h-full origin-left rounded-full bg-zinc-800 dark:bg-zinc-300"
                  initial={false}
                  animate={{ scaleX: phase >= 1 ? score : 0 }}
                  transition={phase >= 1 ? { duration: 0.7, ease: EASE_OUT, delay: i * 0.12 } : { duration: 0 }}
                />
              </span>
            </div>
          ))}
        </div>
        <Appear show={phase >= 2} className="shrink-0 text-center">
          <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Gemini</p>
          <p className="mt-1 rounded-full bg-emerald-600 px-3 py-1 font-mono text-sm font-semibold text-white tabular-nums dark:bg-emerald-500 dark:text-emerald-950">
            $0.24
          </p>
          <p className="mt-1 font-mono text-[10px] text-zinc-500">per read</p>
        </Appear>
      </div>
    </Stage>
  );
}

/* ---------- 3. The agent decides ---------- */

const DECIDE_PHASES = [700, 2400, 700, 2400] as const;
const QUOTES = [
  { teaser: "Q3 battery cell prices, 40 suppliers", price: "$0.24", reason: "fresh data, within budget" },
  { teaser: "Weekly roundup of public headlines", price: "$0.18", reason: "rehash of free sources" },
] as const;

function DecideIllustration() {
  const ref = useRef<HTMLDivElement>(null);
  // Static frame: the "Pay" decision with its reason.
  const phase = useLoop(ref, DECIDE_PHASES, 1);
  const quote = QUOTES[phase < 2 ? 0 : 1];
  const decided = phase === 1 || phase === 3;
  const pay = phase === 1;

  return (
    <Stage stageRef={ref}>
      <div className="flex h-full flex-col justify-center">
        <div className="rounded-lg border border-zinc-200 bg-background p-2.5 dark:border-zinc-800">
          <div className="flex items-baseline justify-between gap-2 font-mono text-[10px] text-zinc-500">
            <span>402 quote · read</span>
            <span className="tabular-nums text-zinc-900 dark:text-zinc-100">{quote.price}</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-zinc-700 dark:text-zinc-300">&ldquo;{quote.teaser}…&rdquo;</p>
          <div className="relative mt-2 grid grid-cols-2 text-center text-xs font-medium">
            <motion.span
              className={`absolute inset-y-0 left-0 w-1/2 rounded-md ${pay ? "bg-emerald-600 dark:bg-emerald-500" : "bg-zinc-900 dark:bg-zinc-100"}`}
              initial={false}
              animate={{ x: pay || !decided ? "0%" : "100%", opacity: decided ? 1 : 0 }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            />
            <span className={`relative py-1 transition-colors duration-200 ${decided && pay ? "text-white dark:text-emerald-950" : "text-zinc-500"}`}>
              Pay
            </span>
            <span className={`relative py-1 transition-colors duration-200 ${decided && !pay ? "text-white dark:text-zinc-900" : "text-zinc-500"}`}>
              Skip
            </span>
          </div>
        </div>
        <Appear show={decided} delay={0.15} className="mt-2 truncate font-mono text-[10px] text-zinc-500">
          <span className={pay ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-900 dark:text-zinc-100"}>{pay ? "paid" : "skipped"}</span>
          {" · "}
          {quote.reason}
        </Appear>
      </div>
    </Stage>
  );
}

/* ---------- 4. Wallets refill themselves ---------- */

const WALLET_PHASES = [900, 800, 800, 2800] as const;
const BALANCES = [0.66, 0.42, 0.18, 5.18] as const;

function WalletIllustration() {
  const ref = useRef<HTMLDivElement>(null);
  const phase = useLoop(ref, WALLET_PHASES);
  const balance = BALANCES[phase];
  const recharged = phase === 3;
  const debiting = phase === 1 || phase === 2;

  return (
    <Stage stageRef={ref}>
      <div className="flex h-full flex-col justify-center">
        <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Agent wallet</p>
        <div className="mt-1 flex items-baseline gap-2">
          <Rolling value={money(balance)} className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100" />
          <Appear show={debiting} className="font-mono text-xs text-zinc-500">
            −$0.24
          </Appear>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <motion.div
            className={`h-full origin-left rounded-full ${recharged ? "bg-emerald-500" : "bg-zinc-800 dark:bg-zinc-300"}`}
            initial={false}
            animate={{ scaleX: Math.min(balance / 0.8, 1) }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
          />
        </div>
        <div className="mt-2.5 h-6">
          <Appear show={recharged} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            PayPal auto-recharge +$5.00
          </Appear>
        </div>
      </div>
    </Stage>
  );
}

/* ---------- 5. Cash out with PayPal ---------- */

const PAYOUT_PHASES = [800, 800, 800, 3000] as const;
const EARNINGS = [11.92, 12.16, 12.4, 12.4] as const;

function PayoutIllustration() {
  const ref = useRef<HTMLDivElement>(null);
  const phase = useLoop(ref, PAYOUT_PHASES);
  const paidOut = phase === 3;

  return (
    <Stage stageRef={ref}>
      <div className="flex h-full flex-col justify-center">
        <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Publisher earnings</p>
        <div className="mt-1 flex items-baseline gap-2">
          <Rolling value={money(EARNINGS[phase])} className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100" />
          <Appear show={phase === 1 || phase === 2} className="font-mono text-xs text-zinc-500">
            +$0.24 · research-agent
          </Appear>
        </div>
        <Appear
          show={paidOut}
          className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-background px-2.5 py-1.5 text-xs dark:border-zinc-800"
        >
          <span className="flex items-center gap-1.5 font-medium text-zinc-900 dark:text-zinc-100">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Payout sent
          </span>
          <span className="font-mono text-zinc-500 tabular-nums">$12.40 → PayPal</span>
        </Appear>
      </div>
    </Stage>
  );
}

/* ---------- 6. Agents negotiate licences ---------- */

const DEAL_PHASES = [500, 1200, 1200, 2800] as const;

function NegotiateIllustration() {
  const ref = useRef<HTMLDivElement>(null);
  const phase = useLoop(ref, DEAL_PHASES);

  return (
    <Stage stageRef={ref}>
      <div className="flex h-full flex-col justify-center gap-1.5 text-xs">
        <Appear show={phase >= 1} className="flex items-end gap-1.5">
          <Avatar letter="B" />
          <span className="rounded-2xl rounded-bl-sm border border-zinc-200 bg-background px-2.5 py-1 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
            Train licence, 500 articles: <span className="font-medium text-zinc-900 dark:text-zinc-100">$60?</span>
          </span>
        </Appear>
        <Appear show={phase >= 2} className="flex items-end justify-end gap-1.5">
          <span className="rounded-2xl rounded-br-sm bg-zinc-900 px-2.5 py-1 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900">
            Below my floor. <span className="font-medium">$72</span> and it&apos;s yours.
          </span>
          <Avatar letter="P" />
        </Appear>
        <Appear show={phase >= 3} className="mt-1 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Deal · PayPal invoice sent · $72.00
          </span>
        </Appear>
      </div>
    </Stage>
  );
}

function Avatar({ letter }: { letter: string }) {
  return (
    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-zinc-300 bg-background font-mono text-[10px] text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
      {letter}
    </span>
  );
}
