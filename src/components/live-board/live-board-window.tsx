"use client";

import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { formatCents } from "@/lib/money";
import type { BoardEvent, BoardTotals } from "./data";

const PILL = { type: "spring", stiffness: 500, damping: 36 } as const;
const ROW = { type: "spring", stiffness: 420, damping: 38 } as const;

// Per-bot colours, assigned by how often each bot appears. Extra bots share the last one.
const HUES = [
  { dot: "bg-emerald-500", avatar: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { dot: "bg-sky-500", avatar: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  { dot: "bg-violet-500", avatar: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  { dot: "bg-rose-500", avatar: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  { dot: "bg-zinc-400", avatar: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300" },
];

type Outcome = "all" | BoardEvent["outcome"];
type License = "all" | BoardEvent["license"];

// A clock shared by every row: null on the server, then ticks every 30 s in the browser.
let now = 0;
const clock = {
  subscribe(onTick: () => void) {
    const id = setInterval(() => {
      now = Date.now();
      onTick();
    }, 30_000);
    return () => clearInterval(id);
  },
  snapshot: () => (now ||= Date.now()),
  server: () => null,
};

function ago(iso: string, at: number) {
  const s = Math.max(0, Math.round((at - Date.parse(iso)) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86_400)}d ago`;
}

/** "RunawayAgent/0.1 (stuck in a loop)" → "RunawayAgent", for tight spaces. */
const shortName = (bot: string) => bot.split(/[/(]/)[0].trim() || bot;

export function LiveBoardWindow({ events, totals }: { events: BoardEvent[]; totals: BoardTotals }) {
  const uid = useId();
  const at = useSyncExternalStore(clock.subscribe, clock.snapshot, clock.server);
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

  const nav: { label: string; value: string; target?: Outcome }[] = [
    { label: "Live traffic", value: String(rows.length), target: "all" },
    { label: "Paid reads", value: totals.paidReads.toLocaleString("en-US"), target: "paid" },
    { label: "Quotes", value: totals.quotes.toLocaleString("en-US"), target: "quoted" },
    { label: "Earnings", value: `$${(totals.earningsCents / 100).toFixed(2)}` },
    { label: "Deals", value: totals.deals.toLocaleString("en-US") },
  ];

  return (
    <TiltIn>
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white/85 shadow-2xl shadow-emerald-900/10 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85 dark:shadow-black/40">
        {/* Title bar */}
        <div className="relative flex h-10 items-center border-b border-zinc-200 px-4 dark:border-zinc-800">
          <div aria-hidden className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          </div>
          <p className="absolute left-1/2 -translate-x-1/2 rounded-md bg-zinc-100 px-3 py-0.5 font-mono text-[11px] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            tollgate / dashboard
          </p>
        </div>

        <div className="flex">
          {/* Sidebar */}
          <aside className="hidden w-52 shrink-0 flex-col gap-6 border-r border-zinc-200 bg-zinc-50/60 p-4 md:flex dark:border-zinc-800 dark:bg-zinc-900/30">
            <p className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="grid h-5 w-5 place-items-center rounded-md bg-emerald-600 font-mono text-[10px] text-white">T</span>
              Tollgate
            </p>
            <ul className="space-y-0.5 text-[13px]">
              {nav.map((item) => {
                const active = item.target !== undefined && item.target === outcome;
                const inner = (
                  <>
                    <span>{item.label}</span>
                    <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{item.value}</span>
                  </>
                );
                const base = "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5";
                return (
                  <li key={item.label}>
                    {item.target ? (
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => setOutcome(item.target!)}
                        className={`${base} transition-colors ${
                          active
                            ? "bg-emerald-500/10 font-medium text-emerald-700 dark:text-emerald-300"
                            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
                        }`}
                      >
                        {inner}
                      </button>
                    ) : (
                      <div className={`${base} text-zinc-600 dark:text-zinc-400`}>{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div>
              <p className="px-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Bots</p>
              <ul className="mt-2 space-y-1.5 px-2 text-xs text-zinc-600 dark:text-zinc-400">
                {bots.slice(0, HUES.length - 1).map((name) => (
                  <li key={name} className="flex items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${hue(name).dot}`} />
                    <span className="truncate" title={name}>{shortName(name)}</span>
                  </li>
                ))}
                {bots.length > HUES.length - 1 && (
                  <li className="flex items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${HUES[HUES.length - 1].dot}`} />
                    <span>Others</span>
                  </li>
                )}
              </ul>
            </div>
          </aside>

          {/* Main pane */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 p-3 dark:border-zinc-800">
              <label className="relative min-w-0 flex-1 basis-full sm:basis-48">
                <svg aria-hidden viewBox="0 0 16 16" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400">
                  <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search bots or articles"
                  aria-label="Search bots or articles"
                  className="w-full rounded-lg border border-zinc-200 bg-transparent py-1.5 pl-8 pr-3 text-sm outline-none placeholder:text-zinc-400 focus:border-emerald-500 dark:border-zinc-800"
                />
              </label>
              <Segmented
                id={`${uid}-bot`}
                label="Bot"
                value={bot}
                onChange={setBot}
                options={[{ value: "all", label: "All bots" }, ...bots.slice(0, 3).map((b) => ({ value: b, label: shortName(b), title: b }))]}
              />
              <Segmented<Outcome>
                id={`${uid}-outcome`}
                label="Outcome"
                value={outcome}
                onChange={setOutcome}
                options={[
                  { value: "all", label: "All" },
                  { value: "paid", label: "Paid" },
                  { value: "quoted", label: "Quoted" },
                ]}
              />
              <Segmented<License>
                id={`${uid}-license`}
                label="License"
                value={license}
                onChange={setLicense}
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

            <div className="relative h-[420px] overflow-hidden [mask-image:linear-gradient(to_bottom,#000_75%,transparent)]">
              <ul className="relative">
                <AnimatePresence initial={false} mode="popLayout">
                  {rows.map((e) => (
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
                        <span aria-hidden className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${hue(e.bot).avatar}`}>
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
                      <time dateTime={e.time} className="hidden text-right font-mono text-xs tabular-nums text-zinc-500 sm:block">
                        {at === null ? "" : ago(e.time, at)}
                      </time>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>

              <AnimatePresence>
                {rows.length === 0 && (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-x-0 top-20 flex flex-col items-center gap-3 px-6 text-center"
                  >
                    <p className="text-sm text-zinc-500">
                      {events.length === 0 ? "No AI traffic yet. Run an agent to see it land here." : "No visits match these filters."}
                    </p>
                    {filtered && (
                      <button
                        type="button"
                        onClick={reset}
                        className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium hover:border-emerald-500 dark:border-zinc-700"
                      >
                        Clear filters
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </TiltIn>
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

/** Tilts the window back and lifts it flat as it scrolls into view. */
function TiltIn({ children }: { children: ReactNode }) {
  const target = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target, offset: ["start end", "start 0.3"] });
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.5 });
  const rotateX = useTransform(progress, [0, 1], [20, 0]);
  const y = useTransform(progress, [0, 1], [50, 0]);

  return (
    <div ref={target} className="relative mt-10 [perspective:1600px]">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-16 -inset-y-12 -z-10 bg-[radial-gradient(circle,rgb(113_113_122/0.28)_1px,transparent_1.5px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,#000_30%,transparent_70%)] dark:bg-[radial-gradient(circle,rgb(161_161_170/0.18)_1px,transparent_1.5px)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-72 w-[70%] -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/15"
      />
      <motion.div style={reduce ? undefined : { rotateX, y, transformOrigin: "50% 0%" }}>{children}</motion.div>
    </div>
  );
}
