"use client";

import {
  AllCommunityModule,
  ModuleRegistry,
  colorSchemeDark,
  colorSchemeLight,
  themeQuartz,
  type ColDef,
  type GridApi,
  type ValueFormatterParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";

ModuleRegistry.registerModules([AllCommunityModule]);

export type TrafficRow = {
  time: string;
  agent: string;
  article: string;
  license: "read" | "train";
  outcome: "paid" | "quoted";
  priceCents: number;
  publisherCents: number;
};

const money = (p: ValueFormatterParams<TrafficRow, number>) => (p.value == null ? "" : `$${(p.value / 100).toFixed(2)}`);

function subscribeDark(callback: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

export function TrafficGrid({ rows }: { rows: TrafficRow[] }) {
  const gridApi = useRef<GridApi<TrafficRow> | null>(null);
  const [search, setSearch] = useState("");
  const dark = useSyncExternalStore(
    subscribeDark,
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false,
  );

  const theme = useMemo(
    () =>
      themeQuartz.withPart(dark ? colorSchemeDark : colorSchemeLight).withParams({
        accentColor: "#059669",
        fontFamily: "inherit",
        headerFontWeight: 600,
        wrapperBorderRadius: 12,
      }),
    [dark],
  );

  const columns = useMemo<ColDef<TrafficRow>[]>(
    () => [
      {
        field: "time",
        headerName: "Time",
        sort: "desc",
        width: 170,
        valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }) : ""),
        filter: "agDateColumnFilter",
      },
      { field: "agent", headerName: "AI agent", filter: true, width: 190 },
      { field: "article", headerName: "Article", filter: true, flex: 1, minWidth: 220, tooltipField: "article" },
      { field: "license", headerName: "License", filter: true, width: 110 },
      {
        field: "outcome",
        headerName: "Outcome",
        filter: true,
        width: 120,
        cellRenderer: (p: { value: TrafficRow["outcome"] }) =>
          p.value === "paid" ? "✅ paid" : "⏳ quoted (402)",
      },
      { field: "priceCents", headerName: "Agent paid", valueFormatter: money, filter: "agNumberColumnFilter", width: 130, type: "rightAligned" },
      {
        field: "publisherCents",
        headerName: "You earned",
        valueFormatter: money,
        filter: "agNumberColumnFilter",
        width: 130,
        type: "rightAligned",
      },
    ],
    [],
  );

  const paid = rows.filter((r) => r.outcome === "paid");
  const earned = paid.reduce((s, r) => s + r.publisherCents, 0);
  const conversion = rows.length ? Math.round((paid.length / rows.length) * 100) : 0;

  return (
    <section className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold">AI traffic &amp; revenue</h2>
          <p className="text-sm text-zinc-500">
            Every 402 quote and paid read · {rows.length} quotes · {conversion}% converted to payment · ${(earned / 100).toFixed(2)} earned
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents, articles…"
            className="w-56 rounded-lg border border-zinc-300 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-700"
          />
          <button
            type="button"
            onClick={() => gridApi.current?.exportDataAsCsv({ fileName: "tollgate-ai-traffic.csv" })}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium dark:border-zinc-700"
          >
            Export CSV
          </button>
        </div>
      </div>
      <div className="h-[460px]">
        <AgGridReact<TrafficRow>
          theme={theme}
          rowData={rows}
          columnDefs={columns}
          defaultColDef={{ sortable: true, resizable: true }}
          quickFilterText={search}
          pagination
          paginationPageSize={20}
          paginationPageSizeSelector={[20, 50, 100]}
          onGridReady={(e) => (gridApi.current = e.api)}
          overlayNoRowsTemplate="No AI agent traffic yet. Run the research agent to see it here."
        />
      </div>
    </section>
  );
}
