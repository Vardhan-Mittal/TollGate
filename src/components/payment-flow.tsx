"use client";

import { motion } from "motion/react";

const NODES = [
  { label: "AI agent", sub: "GET /blog/…" },
  { label: "402 quote", sub: "price set by AI" },
  { label: "PayPal wallet", sub: "pays in cents" },
  { label: "Publisher", sub: "earns, cashes out" },
];

// A payment travelling from agent to publisher, on a loop.
export function PaymentFlow() {
  return (
    <div className="relative mt-10 max-w-3xl">
      <div className="absolute inset-x-[12.5%] top-5 h-px bg-gradient-to-r from-zinc-300 via-emerald-400 to-zinc-300 dark:from-zinc-700 dark:to-zinc-700" />
      <motion.div
        aria-hidden
        className="absolute top-[14px] h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_16px_4px_rgb(16_185_129/0.55)]"
        initial={{ left: "12.5%", opacity: 0 }}
        animate={{ left: ["12.5%", "87.5%"], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 2.6, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.6, times: [0, 0.1, 0.9, 1] }}
        style={{ x: "-50%" }}
      />
      <ol className="relative grid grid-cols-4 text-center">
        {NODES.map((node, i) => (
          <motion.li
            key={node.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.12 }}
            className="flex flex-col items-center"
          >
            <span className="grid h-10 w-10 place-items-center rounded-full border border-zinc-300 bg-background text-sm font-semibold tabular-nums dark:border-zinc-700">
              {i + 1}
            </span>
            <span className="mt-2 text-xs font-semibold sm:text-sm">{node.label}</span>
            <span className="text-[11px] text-zinc-500 sm:text-xs">{node.sub}</span>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
