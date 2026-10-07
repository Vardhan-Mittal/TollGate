"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { AgentEvent } from "@/lib/ai/research-agent";

const PRESETS = [
  { task: "What are current battery cell prices for grid storage, and are there any supply risks I should know about?", budgetCents: 30 },
  { task: "How did batteries help the power grid during this summer's record heat wave?", budgetCents: 25 },
  { task: "Explain how LFP batteries work, for a complete beginner.", budgetCents: 10 },
];
const BUDGETS = [10, 25, 30, 50, 100];

const cents = (c: number) => (c < 100 ? `${c}¢` : `$${(c / 100).toFixed(2)}`);

export function AgentConsole() {
  const router = useRouter();
  const [task, setTask] = useState(PRESETS[0].task);
  const [budgetCents, setBudgetCents] = useState(PRESETS[0].budgetCents);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [running, setRunning] = useState(false);

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    setEvents([]);
    setRunning(true);
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, budgetCents }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        setEvents([{ type: "error", message: body.message ?? "The agent could not start." }]);
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
        const parsed = lines.filter(Boolean).map((line) => JSON.parse(line) as AgentEvent);
        if (parsed.length) setEvents((prev) => [...prev, ...parsed]);
      }
    } catch (err) {
      setEvents((prev) => [...prev, { type: "error", message: err instanceof Error ? err.message : "Connection lost." }]);
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  const answer = events.find((e): e is Extract<AgentEvent, { type: "answer" }> => e.type === "answer");
  const spent = events.reduce((sum, e) => (e.type === "paid" ? sum + e.priceCents : sum), 0);
  const timeline = events.filter((e) => e.type !== "answer" && e.type !== "start");

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <form onSubmit={run} className="space-y-4 self-start rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <label className="block text-sm">
          <span className="font-medium">Task</span>
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            rows={4}
            maxLength={500}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.task}
              type="button"
              onClick={() => {
                setTask(p.task);
                setBudgetCents(p.budgetCents);
              }}
              className="rounded-full border border-zinc-300 px-3 py-1 text-left text-xs text-zinc-600 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
            >
              {p.task.length > 48 ? `${p.task.slice(0, 48)}…` : p.task}
            </button>
          ))}
        </div>
        <div className="text-sm">
          <span className="font-medium">Budget</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {BUDGETS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBudgetCents(b)}
                className={`rounded-lg border px-3 py-1.5 tabular-nums ${
                  budgetCents === b
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                {cents(b)}
              </button>
            ))}
          </div>
        </div>
        <button
          disabled={running || task.trim().length < 5}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {running ? "Agent is working…" : "Run research agent"}
        </button>
        {(running || events.length > 0) && (
          <div className="flex justify-between border-t border-zinc-200 pt-3 text-sm dark:border-zinc-800">
            <span className="text-zinc-500">Spent</span>
            <span className="font-semibold tabular-nums">
              {cents(spent)} of {cents(budgetCents)}
            </span>
          </div>
        )}
      </form>

      <div className="min-w-0 space-y-3">
        {timeline.length === 0 && !running && (
          <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700">
            The agent&apos;s decisions will appear here: every 402 quote it meets, and whether it paid or skipped, with its reason.
          </p>
        )}
        {timeline.map((e, i) => (
          <EventRow key={i} event={e} />
        ))}
        {running && <p className="animate-pulse text-sm text-zinc-500">Thinking…</p>}
        {answer && <AnswerCard answer={answer} />}
      </div>
    </div>
  );
}

function Row({ tone, label, children }: { tone: "zinc" | "amber" | "emerald" | "red" | "sky"; label: string; children: ReactNode }) {
  const tones = {
    zinc: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    sky: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  };
  return (
    <div className="flex gap-3 rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
      <span className={`h-fit shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function EventRow({ event: e }: { event: AgentEvent }) {
  switch (e.type) {
    case "model":
      return <Row tone="zinc" label="AI">Reasoning with {e.modelId}</Row>;
    case "catalog":
      return <Row tone="zinc" label="Browse">Read the publisher&apos;s catalog: {e.count} articles</Row>;
    case "open":
      return <Row tone="zinc" label="GET">{e.path}</Row>;
    case "thought":
      return <Row tone="sky" label="Thinking"><span className="italic">{e.text}</span></Row>;
    case "quote":
      return (
        <Row tone="amber" label={`402 · ${cents(e.priceCents)}`}>
          <p className="font-medium">{e.title}</p>
          <p className="mt-1 text-zinc-500">{e.teaser}</p>
        </Row>
      );
    case "free":
      return <Row tone="zinc" label="Free">{e.title}</Row>;
    case "paid":
      return (
        <Row tone="emerald" label={`Paid ${cents(e.priceCents)}`}>
          <p className="font-medium">{e.title}</p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">{e.reason}</p>
          <p className="mt-1 text-xs text-zinc-500">Wallet balance now ${e.balance}</p>
        </Row>
      );
    case "skipped":
      return (
        <Row tone="zinc" label={`Skipped ${cents(e.priceCents)}`}>
          <p className="font-medium">{e.title}</p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">{e.reason}</p>
        </Row>
      );
    case "refused":
      return (
        <Row tone="red" label="Budget guard">
          <p className="font-medium">{e.title}</p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">{e.reason}</p>
        </Row>
      );
    case "error":
      return <Row tone="red" label="Error">{e.message}</Row>;
    default:
      return null;
  }
}

// Renders the agent's answer: "- " bullets, **bold**, and [Title] citations.
function AnswerCard({ answer }: { answer: Extract<AgentEvent, { type: "answer" }> }) {
  const inline = (text: string) =>
    text.split(/(\*\*[^*]+\*\*|\[[^\]]+\])/g).map((part, i) => {
      if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("[")) {
        return (
          <span key={i} className="mx-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            {part.slice(1, -1)}
          </span>
        );
      }
      return part;
    });

  const lines = answer.text.split("\n").filter((l) => l.trim());

  return (
    <section className="rounded-xl border-2 border-emerald-500/40 p-5">
      <h2 className="font-semibold">Answer</h2>
      <div className="mt-3 space-y-2 text-[15px] leading-7">
        {lines.map((line, i) =>
          /^\s*[-*] /.test(line) ? (
            <p key={i} className="pl-4 -indent-4">• {inline(line.replace(/^\s*[-*] /, ""))}</p>
          ) : (
            <p key={i}>{inline(line.replace(/^#+\s*/, ""))}</p>
          ),
        )}
      </div>
      <div className="mt-4 border-t border-zinc-200 pt-3 text-sm dark:border-zinc-800">
        <p className="text-zinc-500">
          Paid {cents(answer.spentCents)} of a {cents(answer.budgetCents)} budget to {answer.sources.filter((s) => s.paid).length} publisher
          article(s), settled through the agent&apos;s PayPal-funded wallet.
        </p>
        <ul className="mt-2 space-y-1">
          {answer.sources.map((s) => (
            <li key={s.path} className="flex justify-between gap-3">
              <a href={s.path} className="truncate hover:underline">{s.title}</a>
              <span className="shrink-0 tabular-nums text-zinc-500">{s.paid ? cents(s.priceCents) : "free"}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
