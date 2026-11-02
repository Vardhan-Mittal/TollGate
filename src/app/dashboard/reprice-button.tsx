"use client";

import { useState, useTransition } from "react";
import { repriceAll } from "./actions";

export function RepriceButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function reprice() {
    setError(false);
    startTransition(async () => {
      try {
        await repriceAll();
      } catch {
        setError(true);
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={reprice}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:opacity-50 dark:border-zinc-700"
      >
        {pending ? "AI is re-pricing…" : "Re-price all with AI"}
      </button>
      {error && (
        <span role="status" className="text-xs text-red-600">
          Re-pricing failed. Try again shortly.
        </span>
      )}
    </span>
  );
}
