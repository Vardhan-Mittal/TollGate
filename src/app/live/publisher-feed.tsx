"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CountUp } from "@/components/motion";
import type { LiveEvent, LiveFeed } from "@/app/api/live/feed/route";

const POLL_MS = 1500;
const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const short = (cents: number) => (cents < 100 ? `${cents}¢` : usd(cents));

const STYLE: Record<LiveEvent["kind"], { badge: string; tone: string; sign: string }> = {
  quote: { badge: "402", tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", sign: "" },
  earning: { badge: "Earned", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300", sign: "+" },
  topup: { badge: "PayPal", tone: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300", sign: "+" },
  auto_recharge: { badge: "PayPal auto", tone: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300", sign: "+" },
  deal: { badge: "Deal", tone: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300", sign: "" },
  payout: { badge: "Payout", tone: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300", sign: "−" },
};

export function PublisherFeed() {
  const [feed, setFeed] = useState<LiveFeed | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [flash, setFlash] = useState(false);
  const since = useRef<string | null>(null);
  const seen = useRef(new Set<string>());
  const lastEarned = useRef<number | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    // Start with the last five minutes so the panel is not empty on arrival.
    since.current ??= new Date(Date.now() - 5 * 60_000).toISOString();

    async function poll() {
      try {
        const res = await fetch(`/api/live/feed?since=${encodeURIComponent(since.current ?? "")}`, { cache: "no-store" });
        if (res.ok) {
          const next = (await res.json()) as LiveFeed;
          const fresh = next.events.filter((e) => !seen.current.has(e.id));
          fresh.forEach((e) => seen.current.add(e.id));
          if (fresh.length) setEvents((prev) => [...fresh, ...prev].slice(0, 40));
          if (lastEarned.current !== null && next.publisher.earnedTodayCents > lastEarned.current) {
            setFlash(true);
            setTimeout(() => setFlash(false), 900);
          }
          lastEarned.current = next.publisher.earnedTodayCents;
          setFeed(next);
        }
      } catch {
        // A missed poll is fine; the next one catches up.
      }
      if (!stopped) timer = setTimeout(poll, POLL_MS);
    }

    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Earned today" highlight={flash}>
          {feed ? <CountUp value={feed.publisher.earnedTodayCents / 100} prefix="$" decimals={2} /> : "—"}
        </Stat>
        <Stat label="Paid reads today">{feed ? <CountUp value={feed.publisher.paidReadsToday} /> : "—"}</Stat>
        <Stat label="Ready to cash out">{feed ? <CountUp value={feed.publisher.balanceCents / 100} prefix="$" decimals={2} /> : "—"}</Stat>
      </div>

      <div className="space-y-2">
        {events.length === 0 && (
          <p className="flex items-center gap-2 rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 motion-safe:animate-[pulse-dot_1.6s_ease-out_infinite]" />
            Waiting for AI agents… Run the agent on the left and watch quotes and payments land here.
          </p>
        )}
        <AnimatePresence initial={false}>
        {events.map((e) => {
          const style = STYLE[e.kind];
          return (
            <motion.div
              key={e.id}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-start gap-3 rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800"
            >
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${style.tone}`}>{style.badge}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{e.title}</p>
                <p className="truncate text-zinc-500">{e.detail}</p>
              </div>
              <span className={`shrink-0 tabular-nums ${e.kind === "earning" ? "font-semibold text-emerald-600" : "text-zinc-500"}`}>
                {style.sign}
                {short(e.amountCents)}
              </span>
            </motion.div>
          );
        })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Stat({ label, highlight = false, children }: { label: string; highlight?: boolean; children: React.ReactNode }) {
  return (
    <motion.div
      animate={{ scale: highlight ? 1.04 : 1 }}
      className={`rounded-xl p-4 transition-colors duration-700 ${
        highlight ? "bg-emerald-200 dark:bg-emerald-800/60" : "bg-zinc-100 dark:bg-zinc-900"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{children}</p>
    </motion.div>
  );
}
