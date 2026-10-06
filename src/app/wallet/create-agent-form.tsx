"use client";

import { useActionState } from "react";
import { createAgent, type CreateAgentState } from "./actions";

export function CreateAgentForm() {
  const [state, action, pending] = useActionState<CreateAgentState, FormData>(createAgent, {});

  return (
    <div className="rounded-xl border border-dashed border-zinc-300 p-5 dark:border-zinc-700">
      <h2 className="font-semibold">Register a new agent</h2>
      <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-zinc-500">Name</span>
          <input name="name" required placeholder="My research agent" className="mt-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-1.5 dark:border-zinc-700" />
        </label>
        <label className="text-sm">
          <span className="block text-zinc-500">Daily budget ($, optional)</span>
          <input name="dailyBudget" type="number" min="0" step="0.5" placeholder="2.00" className="mt-1 w-32 rounded-lg border border-zinc-300 bg-transparent px-3 py-1.5 dark:border-zinc-700" />
        </label>
        <button disabled={pending} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900">
          {pending ? "Creating…" : "Create agent"}
        </button>
      </form>

      {state.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
      {state.key && (
        <div className="mt-4 rounded-lg bg-emerald-50 p-4 text-sm dark:bg-emerald-950/40">
          <p className="font-medium text-emerald-800 dark:text-emerald-300">
            API key for {state.name}. Copy it now — it will not be shown again.
          </p>
          <code className="mt-2 block break-all rounded bg-white px-2 py-1.5 font-mono text-xs dark:bg-zinc-900">{state.key}</code>
        </div>
      )}
    </div>
  );
}
