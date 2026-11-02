"use client";

import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring, useTransform, type Variants } from "motion/react";
import { useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { formatCents } from "@/lib/money";
import type { BoardData } from "./data";
import { DealsPanel, GuardianPanel, PricingPanel } from "./insight-panels";
import { clock, shortName } from "./shared";
import { HUES, TrafficPanel, useTrafficFilters, type Outcome } from "./traffic-panel";

const PILL = { type: "spring", stiffness: 500, damping: 36 } as const;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const TABS = [
  { id: "traffic", label: "Traffic" },
  { id: "pricing", label: "Pricing" },
  { id: "deals", label: "Deals" },
  { id: "guardian", label: "Guardian" },
] as const;
type Tab = (typeof TABS)[number]["id"];

// The pane slides a little in the direction of travel; exits are quicker than entrances.
const SLIDE: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 16 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.2, ease: EASE_OUT } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -16, transition: { duration: 0.1, ease: EASE_OUT } }),
};
// Reduced motion: no movement, an instant swap.
const SWAP: Variants = { enter: { opacity: 1 }, center: { opacity: 1 }, exit: { opacity: 1, transition: { duration: 0 } } };

const num = (n: number) => n.toLocaleString("en-US");

export function LiveBoardWindow({ data }: { data: BoardData }) {
  const uid = useId();
  const reduce = useReducedMotion();
  const at = useSyncExternalStore(clock.subscribe, clock.snapshot, clock.server);
  const traffic = useTrafficFilters(data.events);
  const [[tab, dir], setTabState] = useState<[Tab, number]>(["traffic", 0]);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (next: Tab) => {
    if (next === tab) return;
    const from = TABS.findIndex((t) => t.id === tab);
    const to = TABS.findIndex((t) => t.id === next);
    setTabState([next, Math.sign(to - from)]);
  };

  // Roving focus: arrows, Home and End move between tabs and select them.
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const keys: Record<string, number> = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const n = (keys[e.key] + TABS.length) % TABS.length;
    select(TABS[n].id);
    tabRefs.current[n]?.focus();
  };

  const { deals, guardian, pricing } = data;
  const counts: Record<Tab, number> = {
    traffic: data.events.length,
    pricing: pricing.length,
    deals: Object.values(deals.byStatus).reduce((a, b) => a + b, 0),
    guardian: guardian.total,
  };
  const panelId = (t: Tab) => `${uid}-panel-${t}`;
  const tabId = (t: Tab) => `${uid}-tab-${t}`;

  const tabBar = (
    <div className="mb-5 flex justify-center">
      <div
        role="tablist"
        aria-label="Dashboard views"
        onKeyDown={onTabKey}
        className="flex max-w-full overflow-x-auto rounded-full border border-zinc-200 bg-white/80 p-1 shadow-sm backdrop-blur [scrollbar-width:none] dark:border-zinc-800 dark:bg-zinc-950/80 [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((t, i) => {
          const selected = t.id === tab;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={tabId(t.id)}
              aria-selected={selected}
              aria-controls={panelId(t.id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(t.id)}
              className={`relative shrink-0 rounded-full px-4 py-1.5 text-sm font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-emerald-500/70 ${
                selected ? "text-white dark:text-zinc-900" : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              {selected && (
                <motion.span
                  layoutId={`${uid}-tab`}
                  transition={reduce ? { duration: 0 } : PILL}
                  className="absolute inset-0 rounded-full bg-zinc-900 dark:bg-zinc-100"
                />
              )}
              <span className="relative flex items-center gap-1.5">
                {t.label}
                <span className="hidden font-mono text-[11px] tabular-nums opacity-60 sm:inline">{num(counts[t.id])}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  // Sidebar detail under the tab list, specific to the open tab.
  const detail: { label: string; value: string; target?: Outcome }[] = {
    traffic: [
      { label: "All visits", value: String(traffic.rows.length), target: "all" as const },
      { label: "Paid reads", value: num(data.totals.paidReads), target: "paid" as const },
      { label: "Quotes", value: num(data.totals.quotes), target: "quoted" as const },
      { label: "Earnings", value: formatCents(data.totals.earningsCents) },
    ],
    pricing: [
      { label: "Priced by AI", value: num(pricing.filter((r) => !r.overridden).length) },
      { label: "Overridden", value: num(pricing.filter((r) => r.overridden).length) },
      {
        label: "Avg value",
        value: (() => {
          const scored = pricing.filter((r) => r.valueScore !== null);
          return scored.length ? String(Math.round(scored.reduce((a, r) => a + (r.valueScore ?? 0), 0) / scored.length)) : "–";
        })(),
      },
    ],
    deals: [
      { label: "Licensed", value: num(deals.byStatus.INVOICED + deals.byStatus.PAID) },
      { label: "No deal", value: num(deals.byStatus.NO_DEAL) },
      { label: "Agreed value", value: formatCents(deals.licensedCents) },
    ],
    guardian: [
      { label: "Held", value: num(guardian.held) },
      { label: "Flagged", value: num(guardian.flagged) },
      { label: "Open", value: num(guardian.open) },
    ],
  }[tab];

  const itemBase = "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5";
  const activeItem = "bg-emerald-500/10 font-medium text-emerald-700 dark:text-emerald-300";
  const idleItem = "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/60";

  return (
    <TiltIn bar={tabBar}>
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white/85 shadow-2xl shadow-emerald-900/10 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85 dark:shadow-black/40">
        {/* Title bar */}
        <div className="relative flex h-10 items-center border-b border-zinc-200 px-4 dark:border-zinc-800">
          <div aria-hidden className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          </div>
          <p className="absolute left-1/2 -translate-x-1/2 rounded-md bg-zinc-100 px-3 py-0.5 font-mono text-[11px] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            tollgate / {tab}
          </p>
        </div>

        <div className="flex">
          {/* Sidebar */}
          <aside className="hidden w-52 shrink-0 flex-col gap-6 border-r border-zinc-200 bg-zinc-50/60 p-4 md:flex dark:border-zinc-800 dark:bg-zinc-900/30">
            <p className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="grid h-5 w-5 place-items-center rounded-md bg-emerald-600 font-mono text-[10px] text-white">T</span>
              Tollgate
            </p>
            <ul className="space-y-0.5 text-[13px]">
              {TABS.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-current={t.id === tab ? "true" : undefined}
                    onClick={() => select(t.id)}
                    className={`${itemBase} transition-colors ${t.id === tab ? activeItem : idleItem}`}
                  >
                    <span>{t.label}</span>
                    <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{num(counts[t.id])}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div>
              <p className="px-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Overview</p>
              <ul className="mt-2 space-y-0.5 text-[13px]">
                {detail.map((item) => {
                  const inner = (
                    <>
                      <span>{item.label}</span>
                      <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{item.value}</span>
                    </>
                  );
                  const target = item.target;
                  return (
                    <li key={item.label}>
                      {target ? (
                        <button
                          type="button"
                          aria-pressed={target === traffic.outcome}
                          onClick={() => traffic.setOutcome(target)}
                          className={`${itemBase} transition-colors ${target === traffic.outcome ? activeItem : idleItem}`}
                        >
                          {inner}
                        </button>
                      ) : (
                        <div className={`${itemBase} text-zinc-600 dark:text-zinc-400`}>{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
            {tab === "traffic" && (
              <div>
                <p className="px-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Bots</p>
                <ul className="mt-2 space-y-1.5 px-2 text-xs text-zinc-600 dark:text-zinc-400">
                  {traffic.bots.slice(0, HUES.length - 1).map((name) => (
                    <li key={name} className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${traffic.hue(name).dot}`} />
                      <span className="truncate" title={name}>{shortName(name)}</span>
                    </li>
                  ))}
                  {traffic.bots.length > HUES.length - 1 && (
                    <li className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${HUES[HUES.length - 1].dot}`} />
                      <span>Others</span>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </aside>

          {/* Content pane: fixed height so switching tabs never moves the page. */}
          <div className="h-[560px] min-w-0 flex-1 overflow-hidden sm:h-[506px]">
            <AnimatePresence mode="wait" initial={false} custom={dir}>
              <motion.div
                key={tab}
                role="tabpanel"
                id={panelId(tab)}
                aria-labelledby={tabId(tab)}
                // Panels without their own controls take focus so keyboard users can reach them.
                tabIndex={tab === "traffic" ? undefined : 0}
                custom={dir}
                variants={reduce ? SWAP : SLIDE}
                initial="enter"
                animate="center"
                exit="exit"
                className="flex h-full flex-col outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/60"
              >
                {tab === "traffic" && <TrafficPanel uid={uid} f={traffic} total={data.events.length} at={at} />}
                {tab === "pricing" && <PricingPanel rows={pricing} />}
                {tab === "deals" && <DealsPanel deals={deals} at={at} />}
                {tab === "guardian" && <GuardianPanel guardian={guardian} at={at} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </TiltIn>
  );
}

/** Tilts the window back and lifts it flat as it scrolls into view. The tab bar stays upright. */
function TiltIn({ bar, children }: { bar: ReactNode; children: ReactNode }) {
  const target = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target, offset: ["start end", "start 0.3"] });
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.5 });
  const rotateX = useTransform(progress, [0, 1], [20, 0]);
  const y = useTransform(progress, [0, 1], [50, 0]);

  return (
    <div ref={target} className="relative mt-10 [perspective:1600px]">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-16 -inset-y-12 -z-10 bg-[radial-gradient(circle,rgb(113_113_122/0.28)_1px,transparent_1.5px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,#000_30%,transparent_70%)] dark:bg-[radial-gradient(circle,rgb(161_161_170/0.18)_1px,transparent_1.5px)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-72 w-[70%] -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/15"
      />
      {bar}
      <motion.div style={reduce ? undefined : { rotateX, y, transformOrigin: "50% 0%" }}>{children}</motion.div>
    </div>
  );
}
