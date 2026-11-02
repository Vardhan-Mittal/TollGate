import { connection } from "next/server";
import { AnalyticsCard, EmptyState, Icons } from "./card";
import { DataTable } from "./chart-bits";
import { getAnalytics, REVENUE_DAYS, TRAFFIC_DAYS, type Analytics, type PricePoint } from "./data";
import { cumulative, DAYS, formatUsd, hourLabel, shortDay } from "./format";
import { PercentileChart, type Marker } from "./percentile-chart";
import { RevenueChart } from "./revenue-chart";
import { VisitHeatmap } from "./visit-heatmap";

// Below these counts a chart would overstate a handful of events; say so instead.
const MIN_DECISIONS = 3;
const MIN_PAID_FOR_PERCENTILES = 5;
const MIN_VISITS_FOR_HEATMAP = 5;

export function AnalyticsHeading() {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="font-semibold">Analytics</h2>
      <p className="font-mono text-xs text-zinc-500">UTC · test traffic excluded</p>
    </div>
  );
}

/** Per-request analytics: four cards over the last 14/30 days. Render inside <Suspense>. */
export async function AnalyticsSection() {
  await connection();
  const data = await getAnalytics();
  return (
    <section aria-label="Analytics">
      <AnalyticsHeading />
      <div className="grid gap-4 lg:grid-cols-2">
        <RevenueCard revenue={data.revenue} />
        <DecisionsCard decisions={data.decisions} />
        <PricesCard prices={data.prices} />
        <HeatmapCard cells={data.heatmap} />
      </div>
    </section>
  );
}

function RevenueCard({ revenue }: { revenue: Analytics["revenue"] }) {
  const total = revenue.reduce((s, d) => s + d.cents, 0);
  const earningDays = revenue.filter((d) => d.cents > 0);
  const best = revenue.reduce((a, d) => (d.cents > a.cents ? d : a), revenue[0]);
  const summary =
    `Daily earnings, last ${REVENUE_DAYS} days: ${formatUsd(total)} in total over ${earningDays.length} ` +
    `${earningDays.length === 1 ? "day" : "days"} with sales; best day ${shortDay(best.day, true)} at ${formatUsd(best.cents)}.`;

  return (
    <AnalyticsCard
      labelledBy="analytics-revenue"
      icon={Icons.revenue}
      title={`Revenue · last ${REVENUE_DAYS} days`}
      subtitle="publisher earnings / utc day"
      value={formatUsd(total)}
      unit="usd · after 10% fee"
    >
      {earningDays.length === 0 ? (
        <EmptyState>No paid reads in the last {REVENUE_DAYS} days, so nothing earned yet.</EmptyState>
      ) : (
        <>
          <RevenueChart days={revenue} summary={summary} />
          <DataTable
            caption={`Earnings per UTC day, last ${REVENUE_DAYS} days`}
            head={["Day", "Earned"]}
            rows={revenue.map((d) => [shortDay(d.day, true), formatUsd(d.cents)])}
          />
        </>
      )}
    </AnalyticsCard>
  );
}

function DecisionsCard({ decisions }: { decisions: Analytics["decisions"] }) {
  const { paid, quoted } = decisions;
  const total = paid + quoted;
  const enough = total >= MIN_DECISIONS;
  const paidShare = enough ? paid / total : 0;
  const rows = [
    { key: "paid", label: "paid reads", count: paid, share: paidShare, swatch: "bg-emerald-600 dark:bg-emerald-400" },
    { key: "quoted", label: "unpaid 402 quotes", count: quoted, share: 1 - paidShare, swatch: "bg-zinc-300 dark:bg-zinc-700" },
  ];

  return (
    <AnalyticsCard
      labelledBy="analytics-decisions"
      icon={Icons.decisions}
      title="Agent decisions"
      subtitle={`paid vs quoted / last ${TRAFFIC_DAYS} days`}
      value={enough ? `${paidShare.toFixed(2)} / ${(1 - paidShare).toFixed(2)}` : undefined}
      unit="paid / quoted"
    >
      {!enough ? (
        <EmptyState>
          Only {total} agent {total === 1 ? "decision" : "decisions"} in the last {TRAFFIC_DAYS} days. The split appears after {MIN_DECISIONS}.
        </EmptyState>
      ) : (
        <div>
          <div
            role="img"
            aria-label={`Of ${total} agent decisions in the last ${TRAFFIC_DAYS} days, ${paid} paid to read (${Math.round(paidShare * 100)}%) and ${quoted} left with an unpaid 402 quote (${Math.round((1 - paidShare) * 100)}%).`}
            className="flex h-2.5 gap-[2px]"
          >
            {rows.map((r) =>
              r.count > 0 ? (
                <span key={r.key} className={`h-full rounded-full ${r.swatch}`} style={{ flexGrow: r.count, flexBasis: 0, minWidth: 4 }} />
              ) : null,
            )}
          </div>
          <dl className="mt-5 divide-y divide-zinc-100 text-sm dark:divide-zinc-900">
            {rows.map((r) => (
              <div key={r.key} className="flex items-center justify-between gap-3 py-2">
                <dt className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <span aria-hidden="true" className={`size-2 rounded-full ${r.swatch}`} />
                  {r.label}
                </dt>
                <dd className="font-mono tabular-nums">
                  {r.count}
                  <span className="ml-3 inline-block w-10 text-right text-zinc-500">{r.share.toFixed(2)}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-zinc-500 text-pretty">
            Each agent that hit a paywalled article either paid for a licence or walked away with the 402 price quote.
          </p>
        </div>
      )}
    </AnalyticsCard>
  );
}

/** Nearest-rank percentile over price groups (sorted ascending). */
function percentile(prices: PricePoint[], total: number, p: number) {
  const rank = Math.max(1, Math.ceil(p * total));
  let seen = 0;
  for (const g of prices) {
    seen += g.reads;
    if (seen >= rank) return g.cents;
  }
  return prices[prices.length - 1].cents;
}

function PricesCard({ prices }: { prices: PricePoint[] }) {
  const total = prices.reduce((s, p) => s + p.reads, 0);
  const enough = total >= MIN_PAID_FOR_PERCENTILES;
  const markers: Marker[] = enough
    ? [
        { label: "p50", cents: percentile(prices, total, 0.5) },
        { label: "p90", cents: percentile(prices, total, 0.9) },
        { label: "p99", cents: percentile(prices, total, 0.99) },
      ]
    : [];
  const tableRows: [string, string][] = cumulative(prices).map((p) => [
    `${p.cents}¢`,
    `${p.reads} ${p.reads === 1 ? "read" : "reads"}, ${Math.round(p.share * 100)}% at or below`,
  ]);

  return (
    <AnalyticsCard
      labelledBy="analytics-prices"
      icon={Icons.percentiles}
      title="Price percentiles"
      subtitle={`paid price per read, ¢ / last ${TRAFFIC_DAYS} days · n=${total}`}
      value={enough ? markers.map((m) => m.cents).join(" / ") : undefined}
      unit="p50 / p90 / p99 · ¢"
    >
      {!enough ? (
        <EmptyState>
          {total} paid {total === 1 ? "read" : "reads"} in the last {TRAFFIC_DAYS} days. Percentiles need at least {MIN_PAID_FOR_PERCENTILES}.
        </EmptyState>
      ) : (
        <>
          <PercentileChart
            prices={prices}
            markers={markers}
            summary={`Cumulative distribution of ${total} paid read prices: median ${markers[0].cents} cents, 90th percentile ${markers[1].cents} cents, 99th percentile ${markers[2].cents} cents.`}
          />
          <DataTable caption="Paid reads by price" head={["Price", "Reads"]} rows={tableRows} />
        </>
      )}
    </AnalyticsCard>
  );
}

function HeatmapCard({ cells }: { cells: Analytics["heatmap"] }) {
  const total = cells.reduce((s, c) => s + c.visits, 0);
  const sorted = [...cells].sort((a, b) => b.visits - a.visits || a.dow - b.dow || a.hour - b.hour);
  const peak = sorted[0];
  const slot = (c: { dow: number; hour: number }) => `${DAYS[c.dow - 1]} ${hourLabel(c.hour)}`;

  return (
    <AnalyticsCard
      labelledBy="analytics-heatmap"
      icon={Icons.heatmap}
      title="When agents visit"
      subtitle={`quoted + paid visits / weekday × hour / last ${TRAFFIC_DAYS} days`}
      value={total >= MIN_VISITS_FOR_HEATMAP ? total.toLocaleString("en-US") : undefined}
      unit={peak ? `visits · peak ${slot(peak)} utc` : undefined}
    >
      {total < MIN_VISITS_FOR_HEATMAP ? (
        <EmptyState>
          {total} bot {total === 1 ? "visit" : "visits"} in the last {TRAFFIC_DAYS} days. The weekly pattern appears after {MIN_VISITS_FOR_HEATMAP}.
        </EmptyState>
      ) : (
        <>
          <VisitHeatmap
            cells={cells}
            summary={`${total} agent visits in the last ${TRAFFIC_DAYS} days across ${cells.length} of 168 weekday-hour slots; busiest ${slot(peak)} UTC with ${peak.visits}.`}
          />
          <DataTable
            caption="Agent visits by weekday and hour (UTC), busiest first; slots with no visits omitted"
            head={["Slot (UTC)", "Visits"]}
            rows={sorted.map((c) => [slot(c), String(c.visits)])}
          />
        </>
      )}
    </AnalyticsCard>
  );
}

/** Same footprint as the loaded section, so nothing jumps when it streams in. */
export function AnalyticsSkeleton() {
  return (
    <section aria-label="Analytics" aria-busy="true">
      <AnalyticsHeading />
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[19rem] rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <div className="h-4 w-32 rounded bg-zinc-100 motion-safe:animate-pulse dark:bg-zinc-900" />
            <div className="mt-2 h-3 w-44 rounded bg-zinc-100 motion-safe:animate-pulse dark:bg-zinc-900" />
            <div className="mt-6 h-7 w-24 rounded bg-zinc-100 motion-safe:animate-pulse dark:bg-zinc-900" />
            <div className="mt-6 h-28 rounded-lg bg-zinc-50 motion-safe:animate-pulse dark:bg-zinc-900/50" />
          </div>
        ))}
      </div>
      <p className="sr-only">Loading analytics…</p>
    </section>
  );
}
