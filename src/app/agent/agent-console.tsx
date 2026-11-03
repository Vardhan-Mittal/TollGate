"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AnswerCard } from "@/components/answer-card";
import { BudgetSlider } from "@/components/budget-slider";
import { ui } from "@/components/ui/kit";
import type { AgentEvent } from "@/lib/ai/research-agent";

const PRESETS = [
  { task: "What are current battery cell prices for grid storage, and are there any supply risks I should know about?", budgetCents: 30 },
  { task: "How did batteries help the power grid during this summer's record heat wave?", budgetCents: 25 },
  { task: "Explain how LFP batteries work, for a complete beginner.", budgetCents: 10 },
];
const BUDGETS = [10, 25, 30, 50, 100];

// A selected chip swaps the outline for a filled pill (kept separate so the two colour sets never clash).
const chip = (active: boolean) => (active ? `rounded-full border px-3 py-1 text-xs transition-colors ${ui.chipActive}` : ui.chip);

const cents = (c: number) => (c < 100 ? `${c}¢` : `$${(c / 100).toFixed(2)}`);

// "split" puts the form beside the timeline; "stacked" fits a narrow column (the /live page).
export function AgentConsole({ layout = "split" }: { layout?: "split" | "stacked" }) {
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
    <div className={layout === "split" ? "mt-10 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-8" : "space-y-5"}>
      {/* On /live the console already sits inside a card, so the form uses the quieter inset surface there. */}
      <form onSubmit={run} className={`space-y-5 self-start ${layout === "split" ? `p-5 sm:p-6 ${ui.card}` : `p-4 sm:p-5 ${ui.inset}`}`}>
        <label className="block text-sm">
          <span className={ui.label}>Task</span>
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            rows={4}
            maxLength={500}
            className={`mt-2 resize-y leading-6 ${ui.input}`}
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
              className={`max-w-full text-left ${chip(task === p.task)}`}
            >
              {p.task.length > 48 ? `${p.task.slice(0, 48)}…` : p.task}
            </button>
          ))}
        </div>
        <BudgetSlider value={budgetCents} steps={BUDGETS} onChange={setBudgetCents} disabled={running} />
        <button
          disabled={running || task.trim().length < 5}
          className={`w-full ${ui.btnAccent}`}
        >
          {running ? "Agent is working…" : "Run research agent"}
        </button>
        {(running || events.length > 0) && (
          <div className="flex items-baseline justify-between border-t border-zinc-200 pt-4 text-sm dark:border-white/10">
            <span className={ui.label}>Spent</span>
            <span className="font-mono font-medium tabular-nums">
              <motion.span key={spent} initial={{ scale: 1.3, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} className="inline-block">
                {cents(spent)}
              </motion.span>{" "}
              of {cents(budgetCents)}
            </span>
          </div>
        )}
      </form>

      <div className="min-w-0 space-y-3">
        {timeline.length === 0 && !running && (
          <p className="rounded-2xl border border-dashed border-zinc-200 p-6 text-sm text-pretty text-zinc-500 dark:border-white/10">
            The agent&apos;s decisions will appear here: every 402 quote it meets, and whether it paid or skipped, with its reason.
          </p>
        )}
        {timeline.map((e, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
            <EventRow event={e} />
          </motion.div>
        ))}
        <AnimatePresence>
          {running && (
            <motion.p
              key="thinking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-sm text-zinc-500"
            >
              <ThinkingDots /> Thinking
            </motion.p>
          )}
        </AnimatePresence>
        {answer && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <AnswerCard answer={answer} />
          </motion.div>
        )}
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-emerald-500"
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

function Row({ tone, label, children }: { tone: "zinc" | "amber" | "emerald" | "red" | "sky"; label: string; children: ReactNode }) {
  const tones = {
    // Same tints as the landing live board's chips.
    zinc: "bg-zinc-500/10 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300",
    amber: "bg-amber-500/12 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    emerald: "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    red: "bg-red-500/12 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    sky: "bg-sky-500/12 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  };
  return (
    <div className="flex gap-3 rounded-xl border border-zinc-200 bg-white/70 p-3 text-sm dark:border-white/10 dark:bg-white/[0.02]">
      <motion.span
        initial={{ scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 18 }}
        className={`h-fit shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${tones[tone]}`}
      >
        {label}
      </motion.span>
      <div className="min-w-0 break-words">{children}</div>
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
    case "owned":
      return (
        <Row tone="sky" label="Already licensed">
          <p className="font-medium">{e.title}</p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Bought {e.minutesAgo < 1 ? "moments" : `${e.minutesAgo} min`} ago for {cents(e.priceCents)}. The licence still holds, so the agent
            reads it again at no charge instead of paying twice.
          </p>
        </Row>
      );
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
