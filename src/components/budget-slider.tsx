"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useId } from "react";
import { SPRING } from "@/components/motion";

const PAD = 10; // Half the thumb, so the thumb stays inside the track at both ends.
const TIERS = ["Thrifty", "Balanced", "Thorough"];

// One 10 × 4 tile of 3 px pixels, each with a fixed "random" brightness, repeated along the track.
const PIXELS = Array.from({ length: 40 }, (_, i) => {
  const c = i % 10;
  const r = Math.floor(i / 10);
  return { x: c * 5, y: r * 5, j: ((c * 7 + r * 13 + c * r) % 10) / 9 };
});

const formatCents = (c: number) => (c < 100 ? `${c}¢` : `$${(c / 100).toFixed(2)}`);
const spokenCents = (c: number) => (c < 100 ? `${c} cents` : `${c / 100} dollar${c === 100 ? "" : "s"}`);
// Where a fraction of the way along sits on the track, in CSS.
const edge = (f: number) => `calc(${PAD}px + (100% - ${PAD * 2}px) * ${f})`;

function nearestIndex(steps: number[], value: number) {
  return steps.reduce((best, s, i) => (Math.abs(s - value) < Math.abs(steps[best] - value) ? i : best), 0);
}

function PixelLayer({ id, weight, className }: { id: string; weight: (j: number) => number; className: string }) {
  return (
    <svg aria-hidden className={`absolute inset-0 h-full w-full ${className}`}>
      <defs>
        <pattern id={id} width="50" height="20" patternUnits="userSpaceOnUse">
          {PIXELS.map((p) => (
            <rect key={`${p.x}-${p.y}`} x={p.x} y={p.y} width="3" height="3" rx="0.6" fill="currentColor" opacity={weight(p.j)} />
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/**
 * A budget picker on a pixel track: pixels left of the thumb light up toward it, the rest stay dim.
 * A real (invisible) range input sits on top, so keyboard, touch and screen readers work natively.
 */
export function BudgetSlider({
  value,
  steps,
  onChange,
  disabled = false,
}: {
  value: number;
  steps: number[];
  onChange: (cents: number) => void;
  disabled?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const index = nearestIndex(steps, value);
  const last = steps.length - 1;
  const fraction = last > 0 ? index / last : 0;
  const tier = TIERS[Math.round(fraction * (TIERS.length - 1))];

  // The lit region and thumb glide to each new step on one spring.
  const reduce = useReducedMotion();
  const progress = useMotionValue(fraction);
  useEffect(() => {
    if (reduce) {
      progress.set(fraction);
      return;
    }
    const controls = animate(progress, fraction, SPRING);
    return () => controls.stop();
  }, [fraction, reduce, progress]);

  const mask = useTransform(
    progress,
    (f) => `linear-gradient(90deg, rgb(0 0 0 / 0.08), #000 ${edge(f)}, transparent ${edge(f)})`,
  );
  // 100cqw is the rail's width, so the thumb moves by transform alone.
  const thumb = useTransform(progress, (f) => `translateX(calc(${f} * 100cqw))`);

  return (
    <div className={`group/budget text-sm ${disabled ? "opacity-50" : ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-baseline gap-2">
          <span id={`${uid}-label`} className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
            Budget
          </span>
          <span className="text-emerald-600 dark:text-emerald-400">{tier}</span>
        </span>
        <span className="font-mono tabular-nums">{formatCents(steps[index])}</span>
      </div>
      <div className="mt-3 flex justify-between text-xs text-zinc-500">
        <span>Thrifty</span>
        <span>Thorough</span>
      </div>

      <div className="relative mt-2 h-[18px]">
        <PixelLayer id={`${uid}-dim`} weight={(j) => 0.55 + 0.45 * j} className="text-zinc-200 dark:text-zinc-800" />
        <motion.div className="absolute inset-0" style={{ maskImage: mask, WebkitMaskImage: mask }}>
          <PixelLayer id={`${uid}-lit`} weight={(j) => 0.25 + 0.75 * j} className="text-emerald-500 dark:text-emerald-400" />
        </motion.div>

        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={index}
          disabled={disabled}
          onChange={(e) => onChange(steps[Number(e.target.value)])}
          aria-labelledby={`${uid}-label`}
          aria-valuetext={`${spokenCents(steps[index])}, ${tier}`}
          className="absolute left-0.5 top-1/2 z-10 m-0 h-11 w-[calc(100%-4px)] -translate-y-1/2 cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />

        {/* Rail the thumb travels along, inset so it never overhangs the track. */}
        <div className="pointer-events-none absolute inset-y-0 @container" style={{ left: PAD, right: PAD }}>
          <motion.div className="absolute left-0 top-1/2" style={{ transform: thumb }}>
            <svg
              aria-hidden
              viewBox="-24 -24 48 48"
              className="absolute left-0 top-0 size-12 -translate-x-1/2 -translate-y-1/2 text-emerald-500 opacity-25 transition-opacity duration-200 group-has-[input:active]/budget:opacity-80 group-has-[input:focus-visible]/budget:opacity-80 group-has-[input:disabled]/budget:opacity-0"
            >
              {Array.from({ length: 8 }, (_, k) => {
                const a = (k * Math.PI) / 4 + Math.PI / 8;
                return (
                  <line
                    key={k}
                    x1={Math.cos(a) * 13}
                    y1={Math.sin(a) * 13}
                    x2={Math.cos(a) * 23}
                    y2={Math.sin(a) * 23}
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeDasharray="0.1 3"
                  />
                );
              })}
            </svg>
            <span
              className={`absolute left-0 top-0 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/40 blur-md dark:bg-emerald-400/25 ${
                disabled ? "" : "motion-safe:animate-pulse"
              }`}
            />
            <span className="absolute left-0 top-0 grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white font-mono text-[11px] font-semibold text-emerald-600 shadow-sm ring-1 ring-emerald-500/50 transition-transform duration-150 ease-out group-has-[input:active]/budget:scale-110 group-has-[input:focus-visible]/budget:ring-2 group-has-[input:focus-visible]/budget:ring-emerald-500 dark:bg-zinc-950 dark:text-emerald-400">
              ¢
            </span>
          </motion.div>
        </div>
      </div>

      {/* Snap points. */}
      <div className="relative mt-2 h-1">
        {steps.map((s, i) => (
          <span
            key={s}
            className={`absolute top-0 size-1 -translate-x-1/2 rounded-full ${
              i === index ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
            }`}
            style={{ left: edge(last > 0 ? i / last : 0) }}
          />
        ))}
      </div>
    </div>
  );
}
