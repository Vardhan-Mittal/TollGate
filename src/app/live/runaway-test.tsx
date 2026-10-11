"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SimulationEvent } from "@/app/api/guardian/simulate/route";
import { unfreezeAgent } from "@/app/wallet/actions";

type Attempt = Extract<SimulationEvent, { type: "attempt" }>;
type Held = Extract<SimulationEvent, { type: "held" }>;

const OUTCOME = {
  paid: { label: "Paid", tone: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  held: { label: "Held", tone: "bg-red-600 text-white" },
  frozen: { label: "Frozen", tone: "bg-red-600 text-white" },
  error: { label: "Error", tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
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
    <div className="mt-8 rounded-xl border border-dashed border-red-300 p-4 dark:border-red-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">🛡 Stress test: a runaway agent</p>
          <p className="text-xs text-zinc-500">An agent stuck in a loop buys the same 1¢ article again and again. Watch the Spend Guardian stop it.</p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="rounded-lg border border-red-400 px-3 py-1.5 text-sm font-medium text-red-700 disabled:opacity-50 dark:text-red-300"
        >
          {running ? "Running…" : "Simulate runaway agent"}
        </button>
      </div>

      {attempts.length > 0 && (
        <ol className="mt-3 space-y-1.5 text-sm">
          {attempts.map((a) => (
            <li key={a.n} className="flex items-center gap-2">
              <span className="w-6 text-right tabular-nums text-zinc-500">#{a.n}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${OUTCOME[a.outcome].tone}`}>{OUTCOME[a.outcome].label}</span>
              <span className="text-zinc-600 dark:text-zinc-400">{a.detail}</span>
            </li>
          ))}
        </ol>
      )}

      {held && (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm dark:bg-red-950/40">
          <p className="font-semibold text-red-700 dark:text-red-300">Wallet frozen · risk {Math.round(held.score * 100)}%</p>
          <ul className="mt-1 list-disc pl-5 text-zinc-700 dark:text-zinc-300">
            {held.signals.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">No more payments or PayPal auto-recharges until the owner decides.</p>
          <form
            action={async (form) => {
              await unfreezeAgent(form);
              setHeld(null);
              setNote("Wallet unfrozen. The agent can pay again.");
            }}
            className="mt-2"
          >
            <input type="hidden" name="agentId" value={held.agentId} />
            {held.eventId && <input type="hidden" name="eventId" value={held.eventId} />}
            <button
              className="rounded-lg bg-zinc-900 px-3 py-1.5 font-medium text-white dark:bg-white dark:text-zinc-900"
            >
              It was a test, unfreeze
            </button>
          </form>
        </div>
      )}

      {note && <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{note}</p>}
    </div>
  );
}
