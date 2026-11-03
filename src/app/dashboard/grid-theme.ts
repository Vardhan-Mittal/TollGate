"use client";

import { AllCommunityModule, ModuleRegistry, colorSchemeDark, colorSchemeLight, themeQuartz } from "ag-grid-community";
import { useMemo, useSyncExternalStore } from "react";

ModuleRegistry.registerModules([AllCommunityModule]);

function subscribeDark(callback: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

// Shared by both modes: the site's quiet, hairline look (zinc header, no column rules, Geist).
const BASE = {
  fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  fontSize: 13,
  headerFontSize: 12,
  headerFontWeight: 500,
  rowHeight: 44,
  headerHeight: 40,
  cellHorizontalPadding: 16,
  columnBorder: false,
  headerColumnBorder: false,
  wrapperBorderRadius: 14,
  borderRadius: 8,
  iconSize: 14,
} as const;

// Solid colours just off the page background (a transparent grid breaks AG Grid's popups and derived shades).
const LIGHT = {
  accentColor: "#059669",
  backgroundColor: "#ffffff",
  foregroundColor: "#18181b",
  borderColor: "#e4e4e7",
  headerBackgroundColor: "#fafafa",
  headerTextColor: "#71717a",
  oddRowBackgroundColor: "#ffffff",
  rowHoverColor: "#f4f4f5",
  selectedRowBackgroundColor: "rgba(16, 185, 129, 0.08)",
} as const;

const DARK = {
  accentColor: "#10b981",
  backgroundColor: "#0e0e10",
  foregroundColor: "#ededed",
  borderColor: "rgba(255, 255, 255, 0.09)",
  headerBackgroundColor: "#131316",
  headerTextColor: "#a1a1aa",
  oddRowBackgroundColor: "#0e0e10",
  rowHoverColor: "rgba(255, 255, 255, 0.03)",
  selectedRowBackgroundColor: "rgba(16, 185, 129, 0.12)",
} as const;

/** The Tollgate AG Grid theme, following the system light/dark setting. */
export function useGridTheme() {
  const dark = useSyncExternalStore(
    subscribeDark,
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false,
  );
  return useMemo(
    () =>
      themeQuartz.withPart(dark ? colorSchemeDark : colorSchemeLight).withParams({ ...BASE, ...(dark ? DARK : LIGHT) }),
    [dark],
  );
}
