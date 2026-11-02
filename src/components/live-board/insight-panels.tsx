import { formatCents } from "@/lib/money";
import type { BoardData, DealStatus, PriceRow } from "./data";
import { Chip, ColumnHeader, Empty, Meter, PanelIntro, shortName, When, type Tone } from "./shared";

const ROW = "grid items-center gap-3 border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-900";
const LIST = "min-h-0 flex-1 overflow-y-auto overscroll-contain";

function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-zinc-500/12 text-xs font-semibold text-zinc-600 dark:bg-zinc-500/20 dark:text-zinc-300">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/* ── Pricing ─────────────────────────────────────────────────────────── */

const PRICE_COLS = "sm:grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_5rem_7rem]";

function Price({ live, ai }: { live: number; ai: number | null }) {
  return (
    <span className="text-right">
      <span className="block font-mono text-sm tabular-nums">{formatCents(live)}</span>
      <span className="block font-mono text-[11px] tabular-nums text-zinc-500">AI {ai === null ? "–" : formatCents(ai)}</span>
    </span>
  );
}

const source = (r: PriceRow) =>
  r.overridden ? <Chip tone="amber">Publisher override</Chip> : <Chip tone="emerald">Priced by AI</Chip>;

export function PricingPanel({ rows }: { rows: BoardData["pricing"] }) {
  return (
    <>
      <PanelIntro>
        An AI reads each article and prices it by freshness, originality, depth and scarcity. Live prices follow
        the suggestion unless the publisher overrides it.
      </PanelIntro>
      <ColumnHeader className={PRICE_COLS}>
        <span>Article</span>
        <span className="text-right">Read</span>
        <span className="text-right">Train</span>
        <span>Value</span>
        <span className="text-right">Set by</span>
      </ColumnHeader>
      {rows.length === 0 ? (
        <Empty>No articles yet. Publish one and the AI prices it within seconds.</Empty>
      ) : (
        <ul className={LIST}>
          {rows.map((r) => (
            <li key={r.id} className={`${ROW} grid-cols-[minmax(0,1fr)_auto] ${PRICE_COLS}`}>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium" title={r.title}>{r.title}</span>
                <span className="block truncate text-xs text-zinc-500" title={r.reasoning ?? undefined}>
                  {r.reasoning ?? "Waiting for the AI to price this article."}
                </span>
              </span>
              {/* Phones: prices and source stacked on the right. */}
              <span className="flex flex-col items-end gap-1 sm:hidden">
                <span className="font-mono text-xs tabular-nums">
                  {formatCents(r.readCents)} · {formatCents(r.trainCents)}
                </span>
                {source(r)}
              </span>
              <span className="hidden sm:block"><Price live={r.readCents} ai={r.aiReadCents} /></span>
              <span className="hidden sm:block"><Price live={r.trainCents} ai={r.aiTrainCents} /></span>
              <span className="hidden space-y-1 sm:block">
                <span className="block font-mono text-xs tabular-nums">{r.valueScore ?? "–"}<span className="text-zinc-500">/100</span></span>
                <Meter value={r.valueScore ?? 0} tone="emerald" />
              </span>
              <span className="hidden justify-end sm:flex">{source(r)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ── Deals ───────────────────────────────────────────────────────────── */

const DEAL_COLS = "sm:grid-cols-[minmax(0,1fr)_4.5rem_7rem_6.5rem_4.5rem]";
const STATUS: Record<DealStatus, { label: string; tone: Tone }> = {
  NEGOTIATING: { label: "Negotiating", tone: "sky" },
  NO_DEAL: { label: "No deal", tone: "zinc" },
  INVOICED: { label: "Invoiced", tone: "amber" },
  PAID: { label: "Paid", tone: "emerald" },
  FAILED: { label: "Failed", tone: "rose" },
};

export function DealsPanel({ deals, at }: { deals: BoardData["deals"]; at: number | null }) {
  return (
    <>
      <PanelIntro>
        Buyer agents haggle with the publisher&apos;s agent over a bulk training licence. An agreed price is
        settled with a PayPal invoice.
      </PanelIntro>
      <ColumnHeader className={DEAL_COLS}>
        <span>Buyer agent</span>
        <span className="text-right">List</span>
        <span className="text-right">Agreed</span>
        <span className="text-right">Status</span>
        <span className="text-right">When</span>
      </ColumnHeader>
      {deals.rows.length === 0 ? (
        <Empty>No licence deals yet. Start one from the Deals page and watch the agents negotiate.</Empty>
      ) : (
        <ul className={LIST}>
          {deals.rows.map((d) => {
            const pct = d.agreedCents === null || d.listCents === 0 ? null : Math.round((d.agreedCents / d.listCents) * 100);
            const status = STATUS[d.status];
            return (
              <li key={d.id} className={`${ROW} grid-cols-[minmax(0,1fr)_auto] ${DEAL_COLS}`}>
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={d.agent} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium" title={d.agent}>{d.agent}</span>
                    <span className="block truncate text-xs text-zinc-500">
                      {d.articles} {d.articles === 1 ? "article" : "articles"} · training licence
                    </span>
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1 sm:hidden">
                  <Chip tone={status.tone}>{status.label}</Chip>
                  <span className="font-mono text-[11px] tabular-nums text-zinc-500">
                    {d.agreedCents === null ? formatCents(d.listCents) : `${formatCents(d.agreedCents)} of ${formatCents(d.listCents)}`}
                  </span>
                </span>
                <span className="hidden text-right font-mono text-sm tabular-nums text-zinc-500 sm:block">{formatCents(d.listCents)}</span>
                <span className="hidden text-right font-mono text-sm tabular-nums sm:block">
                  {d.agreedCents === null ? (
                    <span className="text-zinc-400">–</span>
                  ) : (
                    <>
                      {formatCents(d.agreedCents)} <span className="text-[11px] text-zinc-500">{pct}%</span>
                    </>
                  )}
                </span>
                <span className="hidden justify-end sm:flex"><Chip tone={status.tone}>{status.label}</Chip></span>
                <When iso={d.time} at={at} className="hidden text-right sm:block" />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/* ── Guardian ────────────────────────────────────────────────────────── */

const RISK_COLS = "sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_4.5rem_3.5rem_4.5rem]";

export function GuardianPanel({ guardian, at }: { guardian: BoardData["guardian"]; at: number | null }) {
  return (
    <>
      <PanelIntro>
        The Spend Guardian scores every agent payment before it clears. Odd patterns get flagged; runaway spend is
        held until the owner decides.
      </PanelIntro>
      <ColumnHeader className={RISK_COLS}>
        <span>Agent</span>
        <span>Signal</span>
        <span>Risk</span>
        <span className="text-right">Action</span>
        <span className="text-right">When</span>
      </ColumnHeader>
      {guardian.rows.length === 0 ? (
        <Empty>No risky payments so far. Every agent is spending within its usual pattern.</Empty>
      ) : (
        <ul className={LIST}>
          {guardian.rows.map((e) => {
            const held = e.decision === "HOLD";
            const decision = <Chip tone={held ? "rose" : "amber"}>{held ? "Hold" : "Flag"}</Chip>;
            return (
              <li key={e.id} className={`${ROW} grid-cols-[minmax(0,1fr)_auto] ${RISK_COLS}`}>
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={e.agent} />
                  <span className="min-w-0">
                    {/* Phones: name and tag share a line, the signal goes underneath. */}
                    <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span className="max-w-full truncate text-sm font-medium" title={e.agent}>{shortName(e.agent)}</span>
                      {e.simulation && (
                        <span className="shrink-0 rounded border border-zinc-200 px-1.5 py-px font-mono text-[10px] uppercase text-zinc-500 dark:border-zinc-800">
                          Simulation
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-zinc-500 sm:hidden">{e.summary}</span>
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1 sm:hidden">
                  {decision}
                  <span className="font-mono text-[11px] tabular-nums text-zinc-500">risk {e.scorePct}%</span>
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className="block truncate text-sm text-zinc-700 dark:text-zinc-300" title={e.article ? `${e.summary} (${e.article})` : e.summary}>
                    {e.summary}
                  </span>
                  {e.resolution ? (
                    <span className="block truncate text-xs text-zinc-500" title={e.resolution}>{e.resolution}</span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Open, waiting for the owner
                    </span>
                  )}
                </span>
                <span className="hidden space-y-1 sm:block">
                  <span className="block font-mono text-xs tabular-nums">{e.scorePct}%</span>
                  <Meter value={e.scorePct} tone={e.scorePct >= 80 ? "rose" : "amber"} />
                </span>
                <span className="hidden justify-end sm:flex">{decision}</span>
                <When iso={e.time} at={at} className="hidden text-right sm:block" />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
