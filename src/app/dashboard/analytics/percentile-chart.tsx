"use client";

import { ActiveDot, plotFocus, Tooltip } from "./chart-bits";
import type { PricePoint } from "./data";
import { cumulative } from "./format";
import { useCursor } from "./use-cursor";

export type Marker = { label: string; cents: number };

const TOP = 8; // % of plot height above the 100% line

/**
 * Cumulative share of paid reads at or below each price (an ECDF step curve),
 * with hairline markers at p50/p90/p99. Hover/arrow keys snap to each distinct price.
 */
export function PercentileChart({ prices, markers, summary }: { prices: PricePoint[]; markers: Marker[]; summary: string }) {
  const total = prices.reduce((s, p) => s + p.reads, 0);
  const domain = prices[prices.length - 1].cents * 1.08;
  const x = (cents: number) => (cents / domain) * 100;
  const y = (share: number) => 100 - share * (100 - TOP);

  const steps = cumulative(prices);

  let line = "M0 100";
  for (const s of steps) line += `H${x(s.cents).toFixed(2)}V${y(s.share).toFixed(2)}`;
  line += "H100";

  const nearest = (f: number) => {
    const cents = f * domain;
    let best = 0;
    steps.forEach((s, i) => {
      if (Math.abs(s.cents - cents) < Math.abs(steps[best].cents - cents)) best = i;
    });
    return best;
  };
  const { active, handlers } = useCursor(steps.length, steps.length - 1, nearest);
  const current = active === null ? null : steps[active];

  // Markers that share a price share one label; close neighbours drop to a second row.
  const groups: { cents: number; labels: string[]; row: number }[] = [];
  for (const m of markers) {
    const same = groups.find((g) => g.cents === m.cents);
    if (same) same.labels.push(m.label);
    else groups.push({ cents: m.cents, labels: [m.label], row: 0 });
  }
  groups.forEach((g, i) => {
    const prev = groups[i - 1];
    if (prev && prev.row === 0 && x(g.cents) - x(prev.cents) < 22) g.row = 1;
  });

  return (
    <div>
      <div className="relative h-9" aria-hidden="true">
        {groups.map((g) => {
          const left = x(g.cents);
          const shift = left < 12 ? "0%" : left > 88 ? "-100%" : "-50%";
          return (
            <span
              key={g.cents}
              className="absolute whitespace-nowrap font-mono text-[11px] tabular-nums text-zinc-500"
              style={{ left: `${left}%`, top: g.row ? "50%" : 0, transform: `translateX(${shift})` }}
            >
              {g.labels.join(" ")} <span className="text-zinc-900 dark:text-zinc-100">{g.cents}¢</span>
            </span>
          );
        })}
      </div>
      <div {...handlers} role="img" aria-label={summary} className={`relative h-28 ${plotFocus}`}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
          <line x1="0" x2="100" y1={TOP} y2={TOP} vectorEffect="non-scaling-stroke" strokeWidth="1" className="stroke-zinc-100 dark:stroke-zinc-900" />
          <line x1="0" x2="100" y1={y(0.5)} y2={y(0.5)} vectorEffect="non-scaling-stroke" strokeWidth="1" className="stroke-zinc-100 dark:stroke-zinc-900" />
          {groups.map((g) => (
            <line key={g.cents} x1={x(g.cents)} x2={x(g.cents)} y1={g.row ? -2 : -14} y2="100" vectorEffect="non-scaling-stroke" strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
          ))}
          {current && (
            <line x1={x(current.cents)} x2={x(current.cents)} y1="0" y2="100" vectorEffect="non-scaling-stroke" strokeWidth="1" className="stroke-zinc-400 dark:stroke-zinc-500" />
          )}
          <path d={`${line}V100H0Z`} className="fill-emerald-600/10 dark:fill-emerald-400/10" />
          <line x1="0" x2="100" y1="100" y2="100" vectorEffect="non-scaling-stroke" strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
          <path d={line} fill="none" vectorEffect="non-scaling-stroke" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="stroke-emerald-600 dark:stroke-emerald-400" />
        </svg>
        <span className="pointer-events-none absolute left-0 font-mono text-[11px] tabular-nums text-zinc-500" style={{ top: `${TOP}%`, transform: "translateY(-120%)" }}>
          100%
        </span>
        <span className="pointer-events-none absolute left-0 font-mono text-[11px] tabular-nums text-zinc-500" style={{ top: `${y(0.5)}%`, transform: "translateY(-120%)" }}>
          50%
        </span>
        {current && active !== null && (
          <>
            <ActiveDot x={x(current.cents)} y={y(current.share)} />
            <Tooltip
              x={x(current.cents)}
              y={y(current.share)}
              value={`≤ ${current.cents}¢ · ${Math.round(current.share * 100)}%`}
              label={`${current.cumulative} of ${total} reads`}
            />
          </>
        )}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[11px] text-zinc-500" aria-hidden="true">
        <span>0¢</span>
        <span>price per read</span>
      </div>
      <p className="sr-only" aria-live="polite">
        {current ? `${Math.round(current.share * 100)}% of paid reads cost ${current.cents} cents or less` : ""}
      </p>
    </div>
  );
}
