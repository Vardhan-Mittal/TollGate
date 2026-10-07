"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { NegotiationEvent } from "@/lib/ai/negotiation";

const BUDGETS = [150, 200, 300, 500];
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

type Setup = Extract<NegotiationEvent, { type: "setup" }>;
type Turn = Extract<NegotiationEvent, { type: "turn" }>;
type Invoice = Extract<NegotiationEvent, { type: "invoice" }>;

export function NegotiationConsole({ listPriceCents }: { listPriceCents: number }) {
  const router = useRouter();
  const [budgetCents, setBudgetCents] = useState(300);
  const [events, setEvents] = useState<NegotiationEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [paid, setPaid] = useState(false);

  const setup = events.find((e): e is Setup => e.type === "setup");
  const turns = events.filter((e): e is Turn => e.type === "turn");
  const agreed = events.find((e) => e.type === "agreed") as Extract<NegotiationEvent, { type: "agreed" }> | undefined;
  const noDeal = events.find((e) => e.type === "no_deal") as Extract<NegotiationEvent, { type: "no_deal" }> | undefined;
  const invoice = events.find((e): e is Invoice => e.type === "invoice");
  const errors = events.filter((e) => e.type === "error") as Extract<NegotiationEvent, { type: "error" }>[];

  // After the invoice goes out, watch for the buyer paying it.
  useEffect(() => {
    if (!invoice || !setup || paid) return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/deals/${setup.dealId}`, { cache: "no-store" });
      const body = await res.json().catch(() => null);
      if (body?.status === "PAID") {
        setPaid(true);
        router.refresh();
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [invoice, setup, paid, router]);

  async function run() {
    setEvents([]);
    setPaid(false);
    setRunning(true);
    try {
      const res = await fetch("/api/deals/negotiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgetCents }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        setEvents([{ type: "error", message: body.message ?? "Could not start the negotiation." }]);
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
        const parsed = lines.filter(Boolean).map((l) => JSON.parse(l) as NegotiationEvent);
        if (parsed.length) setEvents((prev) => [...prev, ...parsed]);
      }
    } catch (err) {
      setEvents((prev) => [...prev, { type: "error", message: err instanceof Error ? err.message : "Connection lost." }]);
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="grid gap-4 rounded-2xl border border-zinc-200 p-5 md:grid-cols-3 dark:border-zinc-800">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Package</p>
          <p className="mt-1 text-sm">Training license for every paid article · list {usd(listPriceCents)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Buyer&apos;s private budget</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {BUDGETS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBudgetCents(b)}
                className={`rounded-lg border px-3 py-1 text-sm tabular-nums ${
                  budgetCents === b
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                {usd(b)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-between gap-2">
          <p className="text-xs text-zinc-500">The publisher&apos;s floor is private to its agent. Code enforces both limits.</p>
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white disabled:opacity-50"
          >
            {running ? "Agents are negotiating…" : "Start negotiation"}
          </button>
        </div>
      </div>

      {setup && (
        <div className="flex justify-between text-sm font-semibold">
          <span>🤖 {setup.buyer} (buyer)</span>
          <span>{setup.publisher}&apos;s agent (seller) 📰</span>
        </div>
      )}

      <div className="space-y-3">
        {turns.map((t, i) => {
          const buyer = t.side === "buyer";
          return (
            <div key={i} className={`flex ${buyer ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                  buyer ? "rounded-bl-sm bg-zinc-100 dark:bg-zinc-900" : "rounded-br-sm bg-emerald-50 dark:bg-emerald-950/50"
                }`}
              >
                <div className="mb-1 flex items-center gap-2 text-xs text-zinc-500">
                  <span>Round {t.round}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-semibold ${
                      t.action === "accept"
                        ? "bg-emerald-600 text-white"
                        : t.action === "walk_away"
                          ? "bg-red-600 text-white"
                          : "bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    }`}
                  >
                    {t.action === "accept" ? `Accepts ${usd(t.priceCents)}` : t.action === "walk_away" ? "Walks away" : `Offers ${usd(t.priceCents)}`}
                  </span>
                </div>
                <p>{t.message}</p>
                {t.guard && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">⚖ Code guard: {t.guard}</p>}
              </div>
            </div>
          );
        })}
        {running && <p className="animate-pulse text-center text-sm text-zinc-500">Waiting for the next move…</p>}
      </div>

      {agreed && (
        <section className="rounded-2xl border-2 border-emerald-500/40 p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Deal agreed</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">
            {usd(agreed.priceCents)}{" "}
            <span className="text-base font-normal text-zinc-500">
              ({Math.round((agreed.priceCents / agreed.listPriceCents) * 100)}% of list {usd(agreed.listPriceCents)})
            </span>
          </p>
          {invoice ? (
            <div className="mt-4 space-y-2 text-sm">
              <p>
                The publisher&apos;s agent created and sent PayPal invoice <span className="font-mono">{invoice.invoiceId}</span> to the buyer
                ({invoice.email}) using the PayPal Agent Toolkit.
              </p>
              {paid ? (
                <p className="font-semibold text-emerald-600">✅ Paid through PayPal. The training license is active and the publisher has been credited.</p>
              ) : (
                <>
                  {invoice.url && (
                    <a href={invoice.url} target="_blank" rel="noreferrer" className="inline-block rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-white dark:text-zinc-900">
                      Pay the invoice in the PayPal sandbox ↗
                    </a>
                  )}
                  <p className="text-xs text-zinc-500">Waiting for payment… this page updates when PayPal confirms it.</p>
                </>
              )}
            </div>
          ) : (
            <p className="mt-3 animate-pulse text-sm text-zinc-500">Publisher&apos;s agent is issuing a PayPal invoice…</p>
          )}
        </section>
      )}

      {noDeal && (
        <section className="rounded-2xl border border-zinc-300 p-5 text-sm dark:border-zinc-700">
          <p className="font-semibold">No deal</p>
          <p className="mt-1 text-zinc-500">{noDeal.reason} No money moved.</p>
        </section>
      )}

      {errors.map((e, i) => (
        <p key={i} className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {e.message}
        </p>
      ))}
    </div>
  );
}
