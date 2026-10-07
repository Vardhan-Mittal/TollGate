"use client";

import type { CellValueChangedEvent, ColDef, ICellRendererParams, ValueFormatterParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useMemo, useState } from "react";
import { useGridTheme } from "./grid-theme";
import { resetToAiPrice, setPrice, type PriceRowUpdate } from "./pricing-actions";

export type PriceRow = {
  id: string;
  title: string;
  reasoning: string | null;
  valueScore: number | null;
  aiReadCents: number | null;
  aiTrainCents: number | null;
  readCents: number;
  trainCents: number;
  paidReads: number;
  overridden: boolean;
};

const fmt = (v: number | null | undefined) => (v == null ? "—" : v === 0 ? "free" : v < 100 ? `${v}¢` : `${(v / 100).toFixed(2)}`);
const cents = (p: ValueFormatterParams<PriceRow, number | null>) => fmt(p.value);

// Live price in bold with the AI suggestion underneath, so one column shows both.
function priceCell(aiField: "aiReadCents" | "aiTrainCents") {
  return function PriceCell(p: ICellRendererParams<PriceRow, number>) {
    const ai = p.data?.[aiField];
    const differs = ai != null && ai !== p.value;
    return (
      <div className="py-2 text-right leading-5">
        <p className="font-semibold">{fmt(p.value)}</p>
        <p className={`text-xs ${differs ? "text-amber-600" : "text-zinc-500"}`}>AI {fmt(ai)}</p>
      </div>
    );
  };
}

export function PricingGrid({ rows: initialRows }: { rows: PriceRow[] }) {
  const theme = useGridTheme();
  const [rows, setRows] = useState(initialRows);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function applyUpdate(id: string, update: PriceRowUpdate) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, readCents: update.readCents, trainCents: update.trainCents, overridden: update.overridden } : r)),
    );
  }

  async function onCellValueChanged(e: CellValueChangedEvent<PriceRow>) {
    const field = e.colDef.field === "readCents" ? "read" : "train";
    const value = Number(e.newValue);
    const result = await setPrice({ resourceId: e.data.id, field, cents: Number.isFinite(value) ? Math.round(value) : -1 });
    if (result.ok) {
      applyUpdate(e.data.id, result.row);
      setMessage({ ok: true, text: `Saved. “${e.data.title}” now uses your ${field} price; AI re-pricing will not overwrite it.` });
    } else {
      e.node.setDataValue(e.colDef.field!, e.oldValue);
      setMessage({ ok: false, text: result.error });
    }
  }

  const columns = useMemo<ColDef<PriceRow>[]>(
    () => [
      {
        field: "title",
        headerName: "Article & AI reasoning",
        flex: 3,
        minWidth: 220,
        wrapText: true,
        autoHeight: true,
        cellRenderer: (p: ICellRendererParams<PriceRow>) => (
          <div className="py-2 leading-5">
            <p className="font-medium">{p.data?.title}</p>
            {p.data?.reasoning && <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{p.data.reasoning}</p>}
          </div>
        ),
        tooltipField: "reasoning",
      },
      { field: "valueScore", headerName: "Value", width: 85, type: "rightAligned", sort: "desc", headerTooltip: "AI value score, 0-100" },
      {
        field: "readCents",
        headerName: "Read ✎",
        width: 100,
        editable: true,
        cellEditor: "agNumberCellEditor",
        cellEditorParams: { min: 0, precision: 0 },
        valueFormatter: cents,
        type: "rightAligned",
        cellRenderer: priceCell("aiReadCents"),
      },
      {
        field: "trainCents",
        headerName: "Train ✎",
        width: 100,
        editable: true,
        cellEditor: "agNumberCellEditor",
        cellEditorParams: { min: 0, precision: 0 },
        valueFormatter: cents,
        type: "rightAligned",
        cellRenderer: priceCell("aiTrainCents"),
      },
      { field: "paidReads", headerName: "Reads", width: 85, type: "rightAligned", headerTooltip: "Paid agent reads" },
      {
        field: "overridden",
        headerName: "Priced by",
        width: 135,
        cellRenderer: (p: ICellRendererParams<PriceRow>) =>
          p.data?.overridden ? (
            <button
              type="button"
              className="text-xs font-medium text-emerald-700 underline dark:text-emerald-400"
              onClick={async () => {
                const result = await resetToAiPrice(p.data!.id);
                if (result.ok) {
                  applyUpdate(p.data!.id, result.row);
                  setMessage({ ok: true, text: `“${p.data!.title}” is back on AI pricing.` });
                } else {
                  setMessage({ ok: false, text: result.error });
                }
              }}
            >
              You · reset to AI
            </button>
          ) : (
            <span className="text-xs text-zinc-500">AI</span>
          ),
      },
    ],
    [],
  );

  return (
    <div>
      <div className="h-[430px]">
        <AgGridReact<PriceRow>
          theme={theme}
          rowData={rows}
          getRowId={(p) => p.data.id}
          columnDefs={columns}
          defaultColDef={{ sortable: true, resizable: true }}
          onCellValueChanged={onCellValueChanged}
          singleClickEdit
          stopEditingWhenCellsLoseFocus
          tooltipShowDelay={300}
        />
      </div>
      <p className={`mt-3 min-h-5 text-sm ${message ? (message.ok ? "text-emerald-600" : "text-red-600") : "text-zinc-500"}`}>
        {message?.text ?? "Click a price marked ✎ to override it in cents. 0 makes an article free."}
      </p>
    </div>
  );
}
