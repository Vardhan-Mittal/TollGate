"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CashOutForm({
  defaultEmail,
  lockedEmail,
  balanceCents,
  minCents,
}: {
  defaultEmail: string;
  lockedEmail: string | null;
  balanceCents: number;
  minCents: number;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(lockedEmail ?? defaultEmail);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const enough = balanceCents >= minCents;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    const res = await fetch("/api/publisher/payout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body = await res.json();
    setPending(false);
    setMessage(
      res.ok
        ? { ok: true, text: `Sent $${body.amount} to PayPal (batch ${body.paypal_batch_id}, ${body.paypal_status}).` }
        : { ok: false, text: body.message ?? "Payout failed." },
    );
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm">
        <span className="text-zinc-500">PayPal email to receive earnings</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          readOnly={!!lockedEmail}
          placeholder="you@example.com"
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
        />
        {lockedEmail && (
          <span className="mt-1 block text-xs text-zinc-500">Public demo: payouts always go to the demo publisher&apos;s sandbox account.</span>
        )}
      </label>
      <button
        disabled={pending || !enough}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Sending…" : `Cash out $${(balanceCents / 100).toFixed(2)} with PayPal`}
      </button>
      {!enough && <p className="text-xs text-zinc-500">Minimum payout is ${(minCents / 100).toFixed(2)}.</p>}
      {message && <p className={`text-sm ${message.ok ? "text-emerald-600" : "text-red-600"}`}>{message.text}</p>}
    </form>
  );
}
