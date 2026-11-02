import type { ReactNode } from "react";

// A clock shared by every row: null on the server, then ticks every 30 s in the browser.
let now = 0;
export const clock = {
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

export function ago(iso: string, at: number) {
  const s = Math.max(0, Math.round((at - Date.parse(iso)) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86_400)}d ago`;
}

/** Relative time that renders empty on the server, so hydration always matches. */
export function When({ iso, at, className = "" }: { iso: string; at: number | null; className?: string }) {
  return (
    <time dateTime={iso} className={`font-mono text-xs tabular-nums text-zinc-500 ${className}`}>
      {at === null ? "" : ago(iso, at)}
    </time>
  );
}

/** "RunawayAgent/0.1 (stuck in a loop)" → "RunawayAgent", for tight spaces. */
export const shortName = (bot: string) => bot.split(/[/(]/)[0].trim() || bot;

const TONES = {
  emerald: "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-500/12 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  rose: "bg-rose-500/12 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  sky: "bg-sky-500/12 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  zinc: "bg-zinc-500/10 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300",
} as const;
export type Tone = keyof typeof TONES;

export function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${TONES[tone]}`}>
      {children}
    </span>
  );
}

/** One line of context under the tab, in the slot the Traffic tab uses for its filters. */
export function PanelIntro({ children }: { children: ReactNode }) {
  return (
    <p className="border-b border-zinc-200 px-4 py-3 text-[13px] leading-5 text-pretty text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
      {children}
    </p>
  );
}

export function ColumnHeader({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div
      className={`hidden gap-3 border-b border-zinc-200 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500 sm:grid dark:border-zinc-800 ${className}`}
    >
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-6 pt-20 text-center text-sm text-pretty text-zinc-500">{children}</p>;
}

/** A thin 0–100 meter for value and risk scores. */
export function Meter({ value, tone }: { value: number; tone: "emerald" | "amber" | "rose" }) {
  const fill = { emerald: "bg-emerald-500", amber: "bg-amber-500", rose: "bg-rose-500" }[tone];
  return (
    <span aria-hidden className="block h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
      <span className={`block h-full origin-left rounded-full ${fill}`} style={{ transform: `scaleX(${Math.min(100, Math.max(0, value)) / 100})` }} />
    </span>
  );
}
