"use client";

import { useState, useTransition } from "react";
import { ui } from "@/components/ui/kit";
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
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={reprice}
        className={ui.btnSecondary}
      >
        {pending ? "AI is re-pricing…" : "Re-price all with AI"}
      </button>
      {error && (
        <span role="status" className="text-xs text-red-600 dark:text-red-400">
          Re-pricing failed. Try again shortly.
        </span>
      )}
    </span>
  );
}
