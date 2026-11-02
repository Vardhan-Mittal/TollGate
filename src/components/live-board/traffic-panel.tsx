"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { formatCents } from "@/lib/money";
import type { BoardEvent } from "./data";
import { shortName, When } from "./shared";

const PILL = { type: "spring", stiffness: 500, damping: 36 } as const;
const ROW = { type: "spring", stiffness: 420, damping: 38 } as const;

// Per-bot colours, assigned by how often each bot appears. Extra bots share the last one.
export const HUES = [
  { dot: "bg-emerald-500", avatar: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { dot: "bg-sky-500", avatar: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  { dot: "bg-violet-500", avatar: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  { dot: "bg-rose-500", avatar: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  { dot: "bg-zinc-400", avatar: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300" },
];

export type Outcome = "all" | BoardEvent["outcome"];
type License = "all" | BoardEvent["license"];

/** Filter state lives with the window so the sidebar can drive it and it survives tab switches. */
export function useTrafficFilters(events: BoardEvent[]) {
  const [query, setQuery] = useState("");
  const [bot, setBot] = useState("all");
  const [outcome, setOutcome] = useState<Outcome>("all");
  const [license, setLicense] = useState<License>("all");

  // Bots ranked by frequency; the top three get a filter button, all get a colour.
  const bots = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) counts.set(e.bot, (counts.get(e.bot) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
  }, [events]);
  const hue = (name: string) => HUES[Math.min(bots.indexOf(name), HUES.length - 1)] ?? HUES[HUES.length - 1];

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter(
      (e) =>
        (bot === "all" || e.bot === bot) &&
        (outcome === "all" || e.outcome === outcome) &&
        (license === "all" || e.license === license) &&
        (!q || e.bot.toLowerCase().includes(q) || e.title.toLowerCase().includes(q) || e.path.toLowerCase().includes(q)),
    );
  }, [events, query, bot, outcome, license]);

  const filtered = query !== "" || bot !== "all" || outcome !== "all" || license !== "all";
  const reset = () => {
    setQuery("");
    setBot("all");
    setOutcome("all");
    setLicense("all");
  };

  return { query, setQuery, bot, setBot, outcome, setOutcome, license, setLicense, bots, hue, rows, filtered, reset };
}

export type TrafficFilters = ReturnType<typeof useTrafficFilters>;

export function TrafficPanel({ uid, f, total, at }: { uid: string; f: TrafficFilters; total: number; at: number | null }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 p-3 dark:border-zinc-800">
        <label className="relative min-w-0 flex-1 basis-full sm:basis-48">
          <svg aria-hidden viewBox="0 0 16 16" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400">
            <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            value={f.query}
            onChange={(e) => f.setQuery(e.target.value)}
            placeholder="Search bots or articles…"
            aria-label="Search bots or articles"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-zinc-200 bg-transparent py-1.5 pl-8 pr-3 text-sm outline-none placeholder:text-zinc-400 focus-visible:border-emerald-500 dark:border-zinc-800"
          />
        </label>
        <Segmented
          id={`${uid}-bot`}
          label="Bot"
          value={f.bot}
          onChange={f.setBot}
          options={[{ value: "all", label: "All bots" }, ...f.bots.slice(0, 3).map((b) => ({ value: b, label: shortName(b), title: b }))]}
        />
        <Segmented<Outcome>
          id={`${uid}-outcome`}
          label="Outcome"
          value={f.outcome}
          onChange={f.setOutcome}
          options={[
            { value: "all", label: "All" },
            { value: "paid", label: "Paid" },
            { value: "quoted", label: "Quoted" },
          ]}
        />
        <Segmented<License>
          id={`${uid}-license`}
          label="License"
          value={f.license}
          onChange={f.setLicense}
          options={[
            { value: "all", label: "All" },
            { value: "read", label: "Read" },
            { value: "train", label: "Train" },
          ]}
        />
      </div>

      <div className="hidden grid-cols-[minmax(0,1.25fr)_minmax(0,1.4fr)_9.5rem_4.5rem] gap-3 border-b border-zinc-200 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500 sm:grid dark:border-zinc-800">
        <span>Agent</span>
        <span>Article</span>
        <span className="text-right">Result</span>
        <span className="text-right">When</span>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_bottom,#000_75%,transparent)]">
        <ul className="relative">
          <AnimatePresence initial={false} mode="popLayout">
            {f.rows.map((e) => (
              <motion.li
                key={e.id}
                layout
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={ROW}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-zinc-100 px-4 py-2.5 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1.4fr)_9.5rem_4.5rem] dark:border-zinc-900"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span aria-hidden className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${f.hue(e.bot).avatar}`}>
                    {e.bot.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium" title={e.bot}>{shortName(e.bot)}</span>
                    <span className="block truncate text-xs text-zinc-500 sm:hidden">{e.title}</span>
                  </span>
                </div>
                <span className="hidden truncate text-sm text-zinc-600 sm:block dark:text-zinc-400" title={e.title}>
                  {e.title}
                </span>
                <span className="flex items-center justify-end gap-1.5">
                  <span className="rounded border border-zinc-200 px-1.5 py-px font-mono text-[10px] uppercase text-zinc-500 dark:border-zinc-800">
                    {e.license}
                  </span>
                  <span
                    className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
                      e.outcome === "paid"
                        ? "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "bg-amber-500/12 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                    }`}
                  >
                    {e.outcome === "paid" ? "Paid" : "Quoted"} {formatCents(e.priceCents)}
                  </span>
                </span>
                <When iso={e.time} at={at} className="hidden text-right sm:block" />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <AnimatePresence>
          {f.rows.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute inset-x-0 top-20 flex flex-col items-center gap-3 px-6 text-center"
            >
              <p className="text-sm text-zinc-500">
                {total === 0 ? "No AI traffic yet. Run an agent to see it land here." : "No visits match these filters."}
              </p>
              {f.filtered && (
                <button
                  type="button"
                  onClick={f.reset}
                  className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium hover:border-emerald-500 dark:border-zinc-700"
                >
                  Clear filters
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

type Option<T extends string> = { value: T; label: string; title?: string };

/** A segmented control whose selected background glides between options. */
function Segmented<T extends string>({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: Option<T>[];
}) {
  return (
    <div role="group" aria-label={label} className="flex max-w-full rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-900">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`relative rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${o.value === "all" ? "shrink-0" : "min-w-0"} ${
              selected ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            {selected && (
              <motion.span
                layoutId={id}
                transition={PILL}
                className="absolute inset-0 rounded-md bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700"
              />
            )}
            <span className="relative block max-w-[6.5rem] truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
