"use client";

import Link from "next/link";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Reveal } from "@/components/motion";

// Letters only: generic AI agents, no real products or brand marks.
const AGENTS = ["R", "S", "T", "Q", "A", "N", "K"] as const;
const SIZE = 340; // orbit box, px
const RADIUS = 140; // orbit radius, px
const TURN_SECONDS = 90; // one slow revolution
const COIN_EVERY_MS = 2800;

const FACTS = ["PayPal sandbox", "Signed quotes", "Spend Guardian"];

/** Closing call to action for publishers, with an orbit of AI agents paying a central publisher. */
export function PublisherCta({ className = "" }: { className?: string }) {
  return (
    <section aria-labelledby="publisher-cta-heading" className={`mt-16 overflow-x-clip ${className}`}>
      <Reveal>
        <div className="relative grid items-center gap-10 overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-50 px-5 py-10 sm:px-10 sm:py-12 lg:grid-cols-[minmax(0,1fr)_auto] dark:border-zinc-800 dark:bg-zinc-950">
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-500/10" />

          <div className="relative">
            <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">For publishers</p>
            <h2 id="publisher-cta-heading" className="mt-4 max-w-xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
              Let AI pay for <span className="font-serif text-[1.08em] font-normal italic text-emerald-600 sm:whitespace-nowrap">what it reads.</span>
            </h2>
            <p className="mt-5 max-w-lg text-zinc-600 dark:text-zinc-400">
              Put Tollgate in front of your site and every AI crawler or agent gets a price instead of a free copy. People keep reading
              for free.
            </p>
            <p className="mt-3 max-w-lg text-zinc-600 dark:text-zinc-400">
              AI prices each article within your limits, agents pay from PayPal-funded wallets, and you cash out through PayPal
              whenever you like.
            </p>

            <AgentStack />

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/live"
                className="rounded-lg bg-emerald-700 px-5 py-2.5 font-medium text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              >
                Watch an agent pay
              </Link>
              <Link
                href="/dashboard"
                className="rounded-lg border border-zinc-300 bg-background px-5 py-2.5 font-medium transition-colors hover:border-zinc-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-zinc-700 dark:hover:border-zinc-500"
              >
                Open the dashboard
              </Link>
            </div>

            <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-zinc-500">
              {FACTS.map((fact) => (
                <li key={fact} className="flex items-center gap-1.5">
                  <span aria-hidden className="h-1 w-1 rounded-full bg-emerald-500" />
                  {fact}
                </li>
              ))}
            </ul>
          </div>

          <Orbit />
        </div>
      </Reveal>
    </section>
  );
}

/** Below 640 px: a static row of agent avatars instead of the orbit. */
function AgentStack() {
  return (
    <div aria-hidden className="mt-6 flex items-center gap-3 sm:hidden">
      <div className="flex -space-x-2">
        {AGENTS.slice(0, 5).map((letter) => (
          <span
            key={letter}
            className="grid h-8 w-8 place-items-center rounded-full border border-zinc-300 bg-background font-mono text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
          >
            {letter}
          </span>
        ))}
      </div>
      <span className="font-mono text-xs text-zinc-500">
        → <span className="text-emerald-700 dark:text-emerald-400">$0.24</span> → publisher
      </span>
    </div>
  );
}

function agentPosition(i: number) {
  const angle = (i / AGENTS.length) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.cos(angle) * RADIUS, y: Math.sin(angle) * RADIUS };
}

function Orbit() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-40px 0px" });
  const reduce = useReducedMotion();
  const running = inView && !reduce;

  const rotate = useMotionValue(0);
  const upright = useTransform(rotate, (r) => -r);
  const [coin, setCoin] = useState<{ id: number; agent: number } | null>(null);

  // Turn slowly while on screen; resume from wherever it stopped.
  useEffect(() => {
    if (!running) return;
    const from = rotate.get();
    const controls = animate(rotate, [from, from + 360], { duration: TURN_SECONDS, ease: "linear", repeat: Infinity });
    return () => controls.stop();
  }, [running, rotate]);

  // Every few seconds one agent sends a coin to the publisher.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setCoin((c) => ({ id: (c?.id ?? 0) + 1, agent: ((c?.agent ?? 0) + 3) % AGENTS.length }));
    }, COIN_EVERY_MS);
    return () => clearInterval(id);
  }, [running]);

  const from = coin ? agentPosition(coin.agent) : null;

  return (
    <div ref={ref} aria-hidden className="relative mx-auto hidden shrink-0 sm:block" style={{ width: SIZE, height: SIZE }}>
      {/* Orbit lines */}
      <div className="absolute rounded-full border border-zinc-200 dark:border-zinc-800" style={{ inset: SIZE / 2 - RADIUS }} />
      <div
        className="absolute rounded-full border border-dashed border-zinc-200 dark:border-zinc-800"
        style={{ inset: SIZE / 2 - RADIUS * 0.55 }}
      />

      {/* Rotating layer: agents and coins travel together. */}
      <motion.div className="absolute inset-0" style={{ rotate }}>
        {coin && from && (
          <motion.span
            key={coin.id}
            className="absolute left-1/2 top-1/2 -ml-1.5 -mt-1.5 h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_12px_3px_rgb(16_185_129/0.45)]"
            initial={{ x: from.x, y: from.y, opacity: 0 }}
            animate={{ x: 0, y: 0, opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.2, ease: [0.65, 0, 0.35, 1], opacity: { duration: 1.2, times: [0, 0.15, 0.85, 1] } }}
          />
        )}
        {AGENTS.map((letter, i) => {
          const { x, y } = agentPosition(i);
          const sending = coin?.agent === i;
          return (
            <motion.span
              key={letter}
              className={`absolute left-1/2 top-1/2 -ml-5 -mt-5 grid h-10 w-10 place-items-center rounded-full border bg-background font-mono text-sm shadow-sm transition-colors duration-500 ${
                sending
                  ? "border-emerald-500 text-emerald-700 dark:text-emerald-400"
                  : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
              }`}
              style={{ x, y, rotate: upright }}
            >
              {letter}
            </motion.span>
          );
        })}
      </motion.div>

      {/* The publisher, upright in the centre. */}
      <div className="absolute left-1/2 top-1/2 -ml-12 -mt-12 grid h-24 w-24 place-items-center rounded-2xl border border-zinc-300 bg-background shadow-sm dark:border-zinc-700">
        {coin && (
          <motion.span
            key={coin.id}
            className="absolute inset-0 rounded-2xl border-2 border-emerald-500"
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: [0, 0.6, 0], scale: [1, 1, 1.18] }}
            transition={{ duration: 0.7, delay: 1.05, ease: "easeOut" }}
          />
        )}
        <div className="text-center">
          <span className="mx-auto block h-2 w-2 rounded-full bg-emerald-500" />
          <span className="mt-1.5 block font-mono text-[10px] uppercase tracking-widest text-zinc-500">publisher</span>
          {coin ? (
            <motion.span
              key={coin.id}
              className="mt-0.5 block font-mono text-xs font-medium text-emerald-700 tabular-nums dark:text-emerald-400"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: [0, 1, 1, 0], y: [4, 0, 0, -4] }}
              transition={{ duration: 1.5, delay: 1.05, times: [0, 0.15, 0.75, 1] }}
            >
              +$0.24
            </motion.span>
          ) : (
            <span className="mt-0.5 block font-mono text-xs text-zinc-500">earning</span>
          )}
        </div>
      </div>
    </div>
  );
}
