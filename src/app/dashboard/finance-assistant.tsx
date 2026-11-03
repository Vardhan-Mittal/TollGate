"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SectionLabel, ui } from "@/components/ui/kit";

type Message = { role: "user" | "assistant"; content: string; actions?: { tool: string; detail: string }[] };

const SUGGESTIONS = [
  "How much have AI agents paid me this week?",
  "Which article earns the most, and from which agents?",
  "Draft a PayPal invoice to billing@acme-ai.example for $12.50 of agent content access for October.",
  "Cash out my balance to PayPal.",
];

export function FinanceAssistant() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setPending(true);
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-12).map(({ role, content }) => ({ role, content })) }),
      });
      const body = await res.json();
      setMessages([...next, { role: "assistant", content: body.text ?? body.message ?? "Something went wrong.", actions: body.actions }]);
      router.refresh();
    } catch {
      setMessages([...next, { role: "assistant", content: "Could not reach the assistant." }]);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={`${ui.card} min-w-0 p-5 sm:p-6`}>
      <SectionLabel aside={<span className="font-mono">PayPal Agent Toolkit</span>}>Finance assistant</SectionLabel>
      <p className={`max-w-2xl text-sm text-pretty ${ui.muted}`}>
        Ask about your AI earnings, cash out, or bill an AI company. Uses the PayPal Agent Toolkit; anything that moves money or
        sends an invoice waits for your &ldquo;yes&rdquo;.
      </p>

      <div className="mt-5 flex flex-col gap-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div
              className={`max-w-[85%] break-words rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                m.role === "user"
                  ? "rounded-br-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "rounded-bl-md border border-zinc-200/70 bg-zinc-50 dark:border-white/[0.06] dark:bg-white/[0.03]"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content.replace(/\*\*/g, "")}</p>
              {m.actions && m.actions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.actions.map((a, j) => (
                    <span key={j} title={a.detail} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                      {a.tool}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {pending && <p className="animate-pulse text-sm text-zinc-500">Working…</p>}
      </div>

      {messages.length === 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => send(s)} className={`${ui.chip} text-left`}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-5 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about earnings, payouts or invoices…"
          aria-label="Ask the finance assistant"
          className={`${ui.input} min-w-0 flex-1`}
        />
        <button disabled={pending || !input.trim()} className={`${ui.btnPrimary} shrink-0`}>
          Send
        </button>
      </form>
    </section>
  );
}
