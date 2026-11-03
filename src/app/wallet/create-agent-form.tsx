"use client";

import { useActionState } from "react";
import { SectionLabel, ui } from "@/components/ui/kit";
import { createAgent, type CreateAgentState } from "./actions";

export function CreateAgentForm() {
  const [state, action, pending] = useActionState<CreateAgentState, FormData>(createAgent, {});

  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/40 p-5 sm:p-7 dark:border-white/15 dark:bg-white/[0.01]">
      <SectionLabel>Register a new agent</SectionLabel>
      <form action={action} className="flex flex-wrap items-end gap-3">
        <label className="w-full text-sm sm:w-64">
          <span className="block text-xs text-zinc-500">Name</span>
          <input name="name" required minLength={2} maxLength={40} placeholder="My research agent" className={`${ui.input} mt-1`} />
        </label>
        <label className="w-40 text-sm">
          <span className="block text-xs text-zinc-500">Daily budget ($, optional)</span>
          <input name="dailyBudget" type="number" min="0" max="1000" step="0.5" placeholder="2.00" className={`${ui.input} mt-1 font-mono tabular-nums`} />
        </label>
        <button disabled={pending} className={ui.btnPrimary}>
          {pending ? "Creating…" : "Create agent"}
        </button>
      </form>

      {state.error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state.key && (
        <div className="mt-5 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4 text-sm">
          <p className="font-medium text-emerald-800 dark:text-emerald-300">
            API key for {state.name}. Copy it now — it will not be shown again.
          </p>
          <code className={`${ui.inset} mt-3 block break-all px-3 py-2 font-mono text-xs`}>{state.key}</code>
        </div>
      )}
    </div>
  );
}
