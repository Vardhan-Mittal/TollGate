// Shared by server and client components: keep this module free of directives.

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

export function formatUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

/** "Nov 3" (or "Tue, Nov 3") from "2026-11-03", read as a UTC day. */
export function shortDay(day: string, withWeekday = false) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(withWeekday ? { weekday: "short" } : {}),
  });
}

/** Price groups (ascending) with the running count and share of reads at or below each price. */
export function cumulative<T extends { reads: number }>(groups: T[]) {
  const total = groups.reduce((s, g) => s + g.reads, 0);
  const out: (T & { cumulative: number; share: number })[] = [];
  let seen = 0;
  for (const g of groups) {
    seen += g.reads;
    out.push({ ...g, cumulative: seen, share: seen / total });
  }
  return out;
}
