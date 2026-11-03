"use client";

import type { ColDef, GridApi, ValueFormatterParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useMemo, useRef, useState } from "react";
import { SectionLabel, ui } from "@/components/ui/kit";
import { useGridTheme } from "./grid-theme";

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

export function TrafficGrid({ rows }: { rows: TrafficRow[] }) {
  const gridApi = useRef<GridApi<TrafficRow> | null>(null);
  const [search, setSearch] = useState("");
  const theme = useGridTheme();

  const columns = useMemo<ColDef<TrafficRow>[]>(
    () => [
      {
        field: "time",
        headerName: "Time",
        sort: "desc",
        minWidth: 140,
        flex: 1,
        valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }) : ""),
        filter: "agDateColumnFilter",
      },
      { field: "agent", headerName: "AI agent", filter: true, minWidth: 150, flex: 1.2 },
      { field: "article", headerName: "Article", filter: true, flex: 2, minWidth: 200, tooltipField: "article" },
      { field: "license", headerName: "License", filter: true, width: 100 },
      {
        field: "outcome",
        headerName: "Outcome",
        filter: true,
        width: 115,
        cellRenderer: (p: { value: TrafficRow["outcome"] }) =>
          p.value === "paid" ? "✅ paid" : "402 quoted",
      },
      { field: "priceCents", headerName: "Price", headerTooltip: "Quoted price, or the amount paid", valueFormatter: money, filter: "agNumberColumnFilter", width: 115, type: "rightAligned" },
      {
        field: "publisherCents",
        headerName: "You earned",
        valueFormatter: money,
        filter: "agNumberColumnFilter",
        width: 115,
        type: "rightAligned",
      },
    ],
    [],
  );

  const paid = rows.filter((r) => r.outcome === "paid");
  const earned = paid.reduce((s, r) => s + r.publisherCents, 0);
  const quoted = rows.length - paid.length;
  const conversion = quoted ? Math.round((paid.length / quoted) * 100) : 0;

  return (
    <section className={`${ui.card} min-w-0 p-5 sm:p-6`}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <SectionLabel>AI traffic &amp; revenue</SectionLabel>
          <p className={`text-sm text-pretty ${ui.muted}`}>
            Every 402 quote and paid read · {quoted} quotes · {paid.length} paid ({conversion}%) · ${(earned / 100).toFixed(2)} earned
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents, articles…"
            aria-label="Search agents and articles"
            className={`${ui.input} min-w-0 flex-1 sm:w-56! sm:flex-none`}
          />
          <button
            type="button"
            onClick={() => gridApi.current?.exportDataAsCsv({ fileName: "tollgate-ai-traffic.csv" })}
            className={ui.btnSecondary}
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
