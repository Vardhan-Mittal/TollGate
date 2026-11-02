"use client";

import { formatUsd, shortDay } from "./format";
import { ActiveDot, plotFocus, Tooltip } from "./chart-bits";
import type { RevenueDay } from "./data";
import { useCursor } from "./use-cursor";

const HEADROOM = 12; // % of plot height above the best day

/** Daily earnings as a step area: each UTC day is one flat step, so a quiet day reads as zero, not a slope. */
export function RevenueChart({ days, summary }: { days: RevenueDay[]; summary: string }) {
  const n = days.length;
  const max = Math.max(...days.map((d) => d.cents));
  const y = (cents: number) => 100 - (cents / max) * (100 - HEADROOM);
  const { active, handlers } = useCursor(n, n - 1, (f) => Math.floor(f * n));

  let line = "";
  days.forEach((d, i) => {
    line += `${i === 0 ? "M" : "L"}${i} ${y(d.cents).toFixed(1)}H${i + 1}`;
  });
  const area = `${line}V100H0Z`;
  const current = active === null ? null : days[active];

  return (
    <div>
      <div className="relative">
        <div {...handlers} role="img" aria-label={summary} className={`relative h-28 ${plotFocus}`}>
          <svg viewBox={`0 0 ${n} 100`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
            <line x1="0" x2={n} y1={HEADROOM} y2={HEADROOM} vectorEffect="non-scaling-stroke" className="stroke-zinc-100 dark:stroke-zinc-900" strokeWidth="1" />
            {active !== null && <rect x={active} y="0" width="1" height="100" className="fill-zinc-100 dark:fill-zinc-900" />}
            <path d={area} className="fill-emerald-600/10 dark:fill-emerald-400/10" />
            <line x1="0" x2={n} y1="100" y2="100" vectorEffect="non-scaling-stroke" className="stroke-zinc-300 dark:stroke-zinc-700" strokeWidth="1" />
            <path d={line} fill="none" vectorEffect="non-scaling-stroke" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="stroke-emerald-600 dark:stroke-emerald-400" />
          </svg>
          <span className="pointer-events-none absolute right-0 font-mono text-[11px] tabular-nums text-zinc-500" style={{ top: `${HEADROOM}%`, transform: "translateY(-120%)" }}>
            {formatUsd(max)}
          </span>
          {current && active !== null && (
            <>
              <ActiveDot x={((active + 0.5) / n) * 100} y={y(current.cents)} />
              <Tooltip x={((active + 0.5) / n) * 100} y={y(current.cents)} value={formatUsd(current.cents)} label={shortDay(current.day, true)} />
            </>
          )}
        </div>
      </div>
      <div className="mt-2 flex justify-between font-mono text-[11px] text-zinc-500" aria-hidden="true">
        <span>{shortDay(days[0].day)}</span>
        <span>{shortDay(days[n - 1].day)} UTC</span>
      </div>
      <p className="sr-only" aria-live="polite">
        {current ? `${shortDay(current.day, true)}: ${formatUsd(current.cents)}` : ""}
      </p>
    </div>
  );
}
