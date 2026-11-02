"use client";

import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useId, useRef } from "react";

// One heater-shield outline in a 200 × 240 box, shared by the clip and the hairline.
const SHIELD = "M100 6C128 20 158 27 190 29L190 108C190 168 152 210 100 234C48 210 10 168 10 108L10 29C42 27 72 20 100 6Z";

// Back to front: the front shield sits lowest-left, over the heading, and drifts the most.
const LAYERS = [
  { left: 88, top: 0, drift: 14, glass: "backdrop-blur-[2px] bg-white/15 dark:bg-white/[0.02]" },
  { left: 44, top: 36, drift: 30, glass: "backdrop-blur-[4px] bg-white/20 dark:bg-white/[0.035]" },
  { left: 0, top: 72, drift: 50, glass: "backdrop-blur-[5px] bg-white/30 dark:bg-white/[0.05]" },
] as const;

/**
 * Three stacked glass shields. Each is a real element clipped to the shield path with
 * backdrop-filter, so whatever is painted behind it (the heading, the dot grid) frosts.
 * Without backdrop-filter, or with reduced transparency / more contrast, they fall back
 * to a faint tint and the text behind stays crisp.
 */
export function GuardianShields({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  return (
    <div ref={ref} aria-hidden className={className}>
      {/* 288 × 312 is the stack's footprint at full size; the parent scales it down on small screens. */}
      <div className="relative h-[312px] w-[288px]">
        {LAYERS.map((layer, i) => (
          <Shield key={i} progress={scrollYProgress} front={i === LAYERS.length - 1} index={i} {...layer} />
        ))}
      </div>
    </div>
  );
}

function Shield({
  progress,
  left,
  top,
  drift,
  glass,
  front,
  index,
}: {
  progress: MotionValue<number>;
  left: number;
  top: number;
  drift: number;
  glass: string;
  front: boolean;
  index: number;
}) {
  const reduce = useReducedMotion();
  const parallax = useTransform(progress, [0, 1], [drift, -drift]);
  const gradient = useId();

  return (
    // Opacity/scale live on the glass element itself: opacity on an ancestor would cut it off from the heading behind.
    <motion.div
      data-reveal
      className={`absolute h-[240px] w-[200px] ${glass} backdrop-saturate-150 [@media(prefers-contrast:more)]:backdrop-blur-none [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none`}
      style={{ left, top, y: reduce ? 0 : parallax, clipPath: `path("${SHIELD}")` }}
      initial={{ opacity: 0, scale: 0.94 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ type: "spring", stiffness: 160, damping: 24, delay: index * 0.08 }}
    >
      {/* Hairline edge, brighter at the top like light catching glass. Stroke is 2 so 1px survives the clip. */}
      <svg viewBox="0 0 200 240" className="absolute inset-0 h-full w-full text-zinc-900 dark:text-white">
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity={front ? 0.32 : 0.2} />
            <stop offset="1" stopColor="currentColor" stopOpacity={0.06} />
          </linearGradient>
        </defs>
        <path d={SHIELD} fill="none" stroke={`url(#${gradient})`} strokeWidth={2} />
      </svg>
      {front && (
        <div className="absolute inset-x-0 bottom-[68px] hidden flex-col items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-600 lg:flex dark:text-zinc-400">
          <span>risk 82%</span>
          <span className="h-px w-20 bg-zinc-900/10 dark:bg-white/15">
            <span className="block h-px w-[82%] bg-emerald-600" />
          </span>
          <span className="text-emerald-700 dark:text-emerald-400">hold · 423</span>
        </div>
      )}
    </motion.div>
  );
}
