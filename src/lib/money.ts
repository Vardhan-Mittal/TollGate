import type { Money } from "@/lib/tollgate/protocol";

export function centsToMoney(cents: number): Money {
  return { value: (cents / 100).toFixed(2), currency: "USD" };
}

export function formatCents(cents: number): string {
  if (cents > 0 && cents < 100) return `${cents}¢`;
  return `$${(cents / 100).toFixed(2)}`;
}
