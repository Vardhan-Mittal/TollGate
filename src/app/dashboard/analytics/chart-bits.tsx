import type { ReactNode } from "react";

/**
 * Floating readout for the active mark. Positioned in % of the plot so it tracks the
 * responsive SVG; flips its anchor near the edges so it never leaves the card.
 * Value leads (strong, mono); the label follows (muted).
 */
export function Tooltip({ x, y, value, label }: { x: number; y: number; value: ReactNode; label: ReactNode }) {
  const shift = x < 18 ? "0%" : x > 82 ? "-100%" : "-50%";
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-2 py-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      style={{ left: `${x}%`, top: `${y}%`, transform: `translate(${shift}, calc(-100% - 10px))` }}
    >
      <p className="font-mono text-xs font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{value}</p>
      <p className="text-[11px] text-zinc-500">{label}</p>
    </div>
  );
}

/** The active point: an accent dot with a 2px surface ring. */
export function ActiveDot({ x, y }: { x: number; y: number }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-600 ring-2 ring-white dark:bg-emerald-400 dark:ring-zinc-950"
      style={{ left: `${x}%`, top: `${y}%` }}
    />
  );
}

/** Shared focus treatment for the keyboard-reachable plots. */
export const plotFocus =
  "rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-4 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950";

/** Text alternative: the full data as a table, visually hidden. */
export function DataTable({ caption, head, rows }: { caption: string; head: [string, string]; rows: [string, string][] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{head[0]}</th>
          <th scope="col">{head[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([a, b]) => (
          <tr key={a}>
            <th scope="row">{a}</th>
            <td>{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
