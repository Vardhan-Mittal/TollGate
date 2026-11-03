"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CountUp } from "@/components/motion";
import { ThinkingOrb } from "@/components/thinking-orb";
import { ui } from "@/components/ui/kit";
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
    <div className="mt-10 space-y-6">
      <div className={`grid gap-6 p-5 sm:p-6 md:grid-cols-3 ${ui.card}`}>
        <div>
          <p className={ui.label}>Package</p>
          <p className="mt-2 text-sm text-pretty">Training license for every paid article · list {usd(listPriceCents)}</p>
        </div>
        <div>
          <p className={ui.label}>Buyer&apos;s private budget</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {BUDGETS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBudgetCents(b)}
                className={`relative rounded-full border px-3 py-1 font-mono text-xs tabular-nums transition-colors ${
                  budgetCents === b
                    ? "border-transparent text-white dark:text-zinc-900"
                    : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-white/10 dark:text-zinc-400 dark:hover:border-white/20 dark:hover:text-zinc-100"
                }`}
              >
                {budgetCents === b && (
                  <motion.span layoutId="deal-budget" className="absolute -inset-px rounded-full bg-zinc-900 dark:bg-white" />
                )}
                <span className="relative">{usd(b)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-between gap-3">
          <p className="text-xs text-pretty text-zinc-500">The publisher&apos;s floor is private to its agent. Code enforces both limits.</p>
          <button
            type="button"
            onClick={run}
            disabled={running}
            className={ui.btnAccent}
          >
            {running ? "Agents are negotiating…" : "Start negotiation"}
          </button>
        </div>
      </div>

      {setup && (
        <div className="flex justify-between gap-4 px-1 text-sm font-medium">
          <span>🤖 {setup.buyer} (buyer)</span>
          <span>{setup.publisher}&apos;s agent (seller) 📰</span>
        </div>
      )}

      <div className="space-y-3">
        {turns.map((t, i) => {
          const buyer = t.side === "buyer";
          return (
            <div key={i} className={`flex ${buyer ? "justify-start" : "justify-end"}`}>
              <motion.div
                initial={{ opacity: 0, x: buyer ? -24 : 24, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                style={{ originX: buyer ? 0 : 1 }}
                className={`max-w-[88%] rounded-2xl border px-4 py-3 text-sm leading-6 sm:max-w-[80%] ${
                  buyer
                    ? "rounded-bl-md border-zinc-200/70 bg-zinc-50 dark:border-white/[0.06] dark:bg-white/[0.03]"
                    : "rounded-br-md border-emerald-500/20 bg-emerald-50/70 dark:border-emerald-400/15 dark:bg-emerald-400/[0.06]"
                }`}
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span className="font-mono uppercase tracking-[0.12em]">Round {t.round}</span>
                  <span
                    className={`whitespace-nowrap rounded-full px-2 py-0.5 font-medium tabular-nums ${
                      t.action === "accept"
                        ? "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : t.action === "walk_away"
                          ? "bg-red-500/12 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                          : "bg-white text-zinc-700 ring-1 ring-zinc-200 dark:bg-white/[0.06] dark:text-zinc-200 dark:ring-white/10"
                    }`}
                  >
                    {t.action === "accept" ? `Accepts ${usd(t.priceCents)}` : t.action === "walk_away" ? "Walks away" : `Offers ${usd(t.priceCents)}`}
                  </span>
                </div>
                <p>{t.message}</p>
                {t.guard && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">⚖ Code guard: {t.guard}</p>}
              </motion.div>
            </div>
          );
        })}
        {running && (
          <p className="flex items-center justify-center gap-2 text-sm text-zinc-500">
            <ThinkingOrb size={16} /> Waiting for the next move…
          </p>
        )}
      </div>

      {agreed && (
        <motion.section
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="rounded-2xl border border-emerald-500/40 bg-white/70 p-5 sm:p-6 dark:border-emerald-400/25 dark:bg-emerald-400/[0.03]"
        >
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Deal agreed
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
            <CountUp value={agreed.priceCents / 100} prefix="$" decimals={2} />{" "}
            <span className="text-base font-normal tracking-normal text-zinc-500">
              ({Math.round((agreed.priceCents / agreed.listPriceCents) * 100)}% of list {usd(agreed.listPriceCents)})
            </span>
          </p>
          {invoice ? (
            <div className="mt-4 space-y-3 text-sm">
              <p>
                The publisher&apos;s agent created and sent PayPal invoice <span className="font-mono">{invoice.invoiceId}</span> to the buyer
                ({invoice.email}) using the PayPal Agent Toolkit.
              </p>
              {paid ? (
                <motion.p
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  className="font-medium text-emerald-700 dark:text-emerald-400"
                >
                  ✅ Paid through PayPal. The training license is active and the publisher has been credited.
                </motion.p>
              ) : (
                <>
                  {invoice.url && (
                    <a href={invoice.url} target="_blank" rel="noreferrer" className={ui.btnAccent}>
                      Pay the invoice in the PayPal sandbox ↗
                    </a>
                  )}
                  <p className="text-xs text-zinc-500">Waiting for payment… this page updates when PayPal confirms it.</p>
                </>
              )}
            </div>
          ) : (
            <p className="mt-3 flex items-center gap-2 text-sm text-zinc-500">
              <ThinkingOrb size={16} /> Publisher&apos;s agent is issuing a PayPal invoice…
            </p>
          )}
        </motion.section>
      )}

      {noDeal && (
        <section className={`p-5 text-sm sm:p-6 ${ui.card}`}>
          <p className="font-medium">No deal</p>
          <p className="mt-1 text-zinc-500">{noDeal.reason} No money moved.</p>
        </section>
      )}

      {errors.map((e, i) => (
        <p
          key={i}
          className="rounded-xl border border-red-500/30 bg-red-50/80 p-3 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-500/[0.07] dark:text-red-300"
        >
          {e.message}
        </p>
      ))}
    </div>
  );
}
