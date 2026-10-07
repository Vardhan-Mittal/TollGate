"use client";

import { useTransition } from "react";
import { repriceAll } from "./actions";

export function RepriceButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => repriceAll())}
      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:opacity-50 dark:border-zinc-700"
    >
      {pending ? "AI is re-pricing…" : "Re-price all with AI"}
    </button>
  );
}
