"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
    <section className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
      <h2 className="font-semibold">Finance assistant</h2>
      <p className="text-sm text-zinc-500">
        Ask about your AI earnings, cash out, or bill an AI company. Uses the PayPal Agent Toolkit; anything that moves money or
        sends an invoice waits for your &ldquo;yes&rdquo;.
      </p>

      <div className="mt-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div
              className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-6 ${
                m.role === "user" ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-900"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content.replace(/\*\*/g, "")}</p>
              {m.actions && m.actions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.actions.map((a, j) => (
                    <span key={j} title={a.detail} className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
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
            <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-zinc-300 px-3 py-1 text-left text-xs text-zinc-600 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
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
        className="mt-4 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about earnings, payouts or invoices…"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
        />
        <button disabled={pending || !input.trim()} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900">
          Send
        </button>
      </form>
    </section>
  );
}
