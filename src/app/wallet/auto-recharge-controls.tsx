"use client";

import { useActionState } from "react";
import { disableAutoRecharge, saveAutoRecharge, type AutoRechargeState } from "./actions";

// Both forms share one state so the last answer (saved, capped, refused) is the one shown.
function submit(prev: AutoRechargeState, form: FormData) {
  return form.get("intent") === "off" ? disableAutoRecharge(prev, form) : saveAutoRecharge(prev, form);
}

export function AutoRechargeControls({
  agentId,
  thresholdCents,
  amountCents,
  maxAmountDollars,
}: {
  agentId: string;
  thresholdCents: number | null;
  amountCents: number | null;
  maxAmountDollars: number;
}) {
  const [result, action, pending] = useActionState<AutoRechargeState, FormData>(submit, {});
  const autoOn = thresholdCents != null && amountCents != null;

  return (
    <>
      <form action={action} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="agentId" value={agentId} />
        <label>
          <span className="block text-zinc-500">When below ($)</span>
          <input name="threshold" type="number" min="0" max="100" step="0.5" defaultValue={((thresholdCents ?? 100) / 100).toFixed(2)} className="mt-1 w-24 rounded-lg border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700" />
        </label>
        <label>
          <span className="block text-zinc-500">Add ($)</span>
          <input name="amount" type="number" min="1" max={maxAmountDollars} step="1" defaultValue={Math.min((amountCents ?? 500) / 100, maxAmountDollars).toFixed(0)} className="mt-1 w-24 rounded-lg border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700" />
        </label>
        <button disabled={pending} className="rounded-lg bg-zinc-900 px-3 py-1.5 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900">
          {autoOn ? "Update" : "Turn on"}
        </button>
      </form>
      {autoOn && (
        <form action={action}>
          <input type="hidden" name="agentId" value={agentId} />
          <input type="hidden" name="intent" value="off" />
          <button disabled={pending} className="text-zinc-600 underline disabled:opacity-50 dark:text-zinc-400">Turn off</button>
        </form>
      )}
      {result.error && <p className="text-red-600">{result.error}</p>}
      {!result.error && result.message && <p className="text-emerald-700 dark:text-emerald-400">{result.message}</p>}
    </>
  );
}
