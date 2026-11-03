"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SimulationEvent } from "@/app/api/guardian/simulate/route";
import { unfreezeAgent } from "@/app/wallet/actions";
import { ui } from "@/components/ui/kit";

type Attempt = Extract<SimulationEvent, { type: "attempt" }>;
type Held = Extract<SimulationEvent, { type: "held" }>;

// Chip tones match the landing live board; red only once the Guardian steps in.
const RED = "bg-red-500/12 text-red-700 dark:bg-red-500/15 dark:text-red-300";
const OUTCOME = {
  paid: { label: "Paid", tone: "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  held: { label: "Held", tone: RED },
  frozen: { label: "Frozen", tone: RED },
  error: { label: "Error", tone: RED },
};

// Stress test for the Spend Guardian: an agent stuck in a loop keeps buying the
// same article through the real payment API until the Guardian freezes it.
export function RunawayTest() {
  const router = useRouter();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [held, setHeld] = useState<Held | null>(null);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function run() {
    setAttempts([]);
    setHeld(null);
    setNote(null);
    setRunning(true);
    try {
      const res = await fetch("/api/guardian/simulate", { method: "POST" });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        setNote(body.message ?? "Could not start the simulation.");
        return;
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const e = JSON.parse(line) as SimulationEvent;
          if (e.type === "attempt") setAttempts((prev) => [...prev, e]);
          if (e.type === "held") setHeld(e);
        }
      }
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  return (
    <div className={`mt-8 p-4 sm:p-5 ${ui.card}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1 basis-64">
          <p className="font-medium tracking-tight">🛡 Stress test: a runaway agent</p>
          <p className={`mt-1 text-sm text-pretty ${ui.muted}`}>
            An agent stuck in a loop buys the same cheap article again and again, from its own test wallet. Watch the Spend Guardian stop it.
          </p>
        </div>
        <button type="button" onClick={run} disabled={running} className={ui.btnAccent}>
          {running ? "Running…" : "Simulate runaway agent"}
        </button>
      </div>

      {attempts.length > 0 && (
        <ol className={`mt-4 space-y-1.5 p-3 text-sm ${ui.inset}`}>
          {attempts.map((a) => (
            <motion.li key={a.n} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-2.5">
              <span className="w-7 shrink-0 pt-0.5 text-right font-mono text-xs tabular-nums text-zinc-500">#{a.n}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${OUTCOME[a.outcome].tone}`}>{OUTCOME[a.outcome].label}</span>
              <span className={`min-w-0 ${ui.muted}`}>{a.detail}</span>
            </motion.li>
          ))}
        </ol>
      )}

      {held && (
        // A short shake, like a card terminal declining a payment.
        <motion.div
          initial={{ opacity: 0, x: 0 }}
          animate={{ opacity: 1, x: [0, -8, 8, -6, 6, -3, 0] }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mt-4 rounded-xl border border-red-500/30 bg-red-50/80 p-4 text-sm dark:border-red-400/20 dark:bg-red-500/[0.07]"
        >
          <p className="flex items-center gap-2 font-medium text-red-700 dark:text-red-300">
            <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
            Wallet frozen · risk {Math.round(held.score * 100)}%</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-zinc-700 dark:text-zinc-300">
            {held.signals.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            No more payments or PayPal auto-recharges from this wallet until the owner decides. Only the test wallet is frozen: the research
            agent above keeps working, and each new run starts with a fresh test wallet.
          </p>
          <form
            action={async (form) => {
              await unfreezeAgent(form);
              setHeld(null);
              setNote("Wallet unfrozen. The agent can pay again.");
            }}
            className="mt-4"
          >
            <input type="hidden" name="agentId" value={held.agentId} />
            {held.eventId && <input type="hidden" name="eventId" value={held.eventId} />}
            <button className={ui.btnPrimary}>
              It was a test, unfreeze
            </button>
          </form>
        </motion.div>
      )}

      {note && <p className={`mt-3 text-sm ${ui.muted}`}>{note}</p>}
    </div>
  );
}
