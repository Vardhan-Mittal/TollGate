"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CountUp } from "@/components/motion";
import { Chip, type Tone } from "@/components/live-board/shared";
import { ui } from "@/components/ui/kit";
import type { LiveEvent, LiveFeed } from "@/app/api/live/feed/route";

const POLL_MS = 1500;
const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const short = (cents: number) => (cents < 100 ? `${cents}¢` : usd(cents));

// Same chip tones as the landing live board: emerald for money earned, amber for a quote, muted otherwise.
const STYLE: Record<LiveEvent["kind"], { badge: string; tone: Tone; sign: string }> = {
  quote: { badge: "402", tone: "amber", sign: "" },
  earning: { badge: "Earned", tone: "emerald", sign: "+" },
  topup: { badge: "PayPal", tone: "sky", sign: "+" },
  auto_recharge: { badge: "PayPal auto", tone: "sky", sign: "+" },
  deal: { badge: "Deal", tone: "zinc", sign: "" },
  payout: { badge: "Payout", tone: "zinc", sign: "−" },
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
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="Earned today" highlight={flash}>
          {feed ? <CountUp value={feed.publisher.earnedTodayCents / 100} prefix="$" decimals={2} /> : "—"}
        </Stat>
        <Stat label="Paid reads today">{feed ? <CountUp value={feed.publisher.paidReadsToday} /> : "—"}</Stat>
        <Stat label="Ready to cash out">{feed ? <CountUp value={feed.publisher.balanceCents / 100} prefix="$" decimals={2} /> : "—"}</Stat>
      </div>

      <div className="space-y-2">
        {events.length === 0 && (
          <p className="flex items-center gap-3 rounded-xl border border-dashed border-zinc-200 p-6 text-sm text-pretty text-zinc-500 dark:border-white/10">
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
              className={`flex items-start gap-3 p-3 text-sm ${ui.inset}`}
            >
              <span className="mt-px shrink-0">
                <Chip tone={style.tone}>{style.badge}</Chip>
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{e.title}</p>
                <p className="truncate text-zinc-500">{e.detail}</p>
              </div>
              <span
                className={`shrink-0 font-mono text-[13px] tabular-nums ${
                  e.kind === "earning" ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-zinc-500"
                }`}
              >
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
      className={`min-w-0 rounded-xl border p-3 transition-colors duration-700 sm:p-4 ${
        highlight
          ? "border-emerald-500/40 bg-emerald-50 dark:border-emerald-400/30 dark:bg-emerald-400/10"
          : "border-zinc-200/70 bg-zinc-50 dark:border-white/[0.06] dark:bg-white/[0.03]"
      }`}
    >
      <p className="font-mono text-[10px] uppercase leading-4 tracking-[0.12em] text-zinc-500 sm:text-[11px] sm:tracking-[0.14em]">{label}</p>
      <p className="mt-1.5 text-lg font-semibold tracking-tight tabular-nums sm:text-2xl">{children}</p>
    </motion.div>
  );
}
