"use client";

import { useState, type KeyboardEvent } from "react";
import { Tooltip } from "./chart-bits";
import type { HeatCell } from "./data";
import { DAYS, hourLabel } from "./format";

const HOURS = 24;
const TICKS = [0, 6, 12, 18];

// One hue, more = more ink. Light steps darken; dark steps brighten. Validated as
// ordinal ramps (monotone lightness, visible steps, lightest step ≥ 2:1 on the surface).
const LEVELS = [
  "bg-zinc-100 dark:bg-zinc-900",
  "bg-emerald-500 dark:bg-emerald-800",
  "bg-emerald-700 dark:bg-emerald-600",
  "bg-emerald-900 dark:bg-emerald-400",
  "bg-emerald-950 dark:bg-emerald-200",
];

/** Upper bound (inclusive) of each of the four non-zero levels. */
function levelBounds(max: number) {
  return [1, 2, 3, 4].map((k) => Math.max(1, Math.floor((k * max) / 4)));
}

export function VisitHeatmap({ cells, summary }: { cells: HeatCell[]; summary: string }) {
  const grid = Array.from({ length: 7 }, () => new Array<number>(HOURS).fill(0));
  for (const c of cells) grid[c.dow - 1][c.hour] = c.visits;
  const max = Math.max(1, ...cells.map((c) => c.visits));
  const bounds = levelBounds(max);
  const level = (v: number) => (v === 0 ? 0 : bounds.findIndex((b) => v <= b) + 1);

  // Keyboard starts on the busiest slot.
  const busiest = cells.reduce((a, c) => (c.visits > a.visits ? c : a), cells[0]);
  const start = { d: busiest.dow - 1, h: busiest.hour };
  const [active, setActive] = useState<{ d: number; h: number } | null>(null);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
    };
    if (e.key === "Escape") return setActive(null);
    const step = delta[e.key];
    if (!step) return;
    e.preventDefault();
    setActive((a) => {
      const from = a ?? start;
      return { d: Math.max(0, Math.min(6, from.d + step[0])), h: Math.max(0, Math.min(HOURS - 1, from.h + step[1])) };
    });
  }

  const current = active && { ...active, visits: grid[active.d][active.h] };
  const legend = [{ level: 0, text: "0" }].concat(
    bounds.flatMap((hi, i) => {
      const lo = i === 0 ? 1 : bounds[i - 1] + 1;
      return lo > hi ? [] : [{ level: i + 1, text: lo === hi ? `${hi}` : `${lo}–${hi}` }];
    }),
  );

  return (
    <div>
      <div
        tabIndex={0}
        role="img"
        aria-label={summary}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((a) => a ?? start)}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
        className="relative rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-4 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950"
      >
        <div className="grid grid-cols-[2rem_repeat(24,minmax(0,1fr))] gap-[3px]" aria-hidden="true">
          {grid.map((row, d) => (
            <div key={DAYS[d]} className="contents">
              <span className="self-center font-mono text-[10px] leading-none text-zinc-500">{DAYS[d]}</span>
              {row.map((visits, h) => {
                const on = current?.d === d && current.h === h;
                return (
                  <span
                    key={h}
                    onPointerEnter={() => setActive({ d, h })}
                    className={`aspect-square rounded-full ${LEVELS[level(visits)]} ${on ? "ring-2 ring-zinc-900 ring-offset-1 ring-offset-white dark:ring-zinc-100 dark:ring-offset-zinc-950" : ""}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
        {current && (
          <div className="pointer-events-none absolute inset-y-0 right-0 left-[calc(2rem+3px)]">
            <Tooltip
              x={((current.h + 0.5) / HOURS) * 100}
              y={(current.d / 7) * 100}
              value={`${current.visits} ${current.visits === 1 ? "visit" : "visits"}`}
              label={`${DAYS[current.d]} ${hourLabel(current.h)} UTC`}
            />
          </div>
        )}
      </div>
      <div className="relative mt-1.5 ml-[calc(2rem+3px)] h-4 font-mono text-[10px] text-zinc-500" aria-hidden="true">
        {TICKS.map((h) => (
          <span key={h} className="absolute" style={{ left: `${(h / HOURS) * 100}%` }}>
            {String(h).padStart(2, "0")}
          </span>
        ))}
        <span className="absolute right-0">UTC</span>
      </div>
      <ul className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-zinc-500" aria-label="Legend: visits per hour slot">
        {legend.map((l) => (
          <li key={l.level} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`size-2.5 rounded-full ${LEVELS[l.level]}`} />
            {l.text}
          </li>
        ))}
      </ul>
      <p className="sr-only" aria-live="polite">
        {current ? `${DAYS[current.d]} ${hourLabel(current.h)} UTC: ${current.visits} visits` : ""}
      </p>
    </div>
  );
}
