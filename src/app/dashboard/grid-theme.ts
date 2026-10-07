"use client";

import { AllCommunityModule, ModuleRegistry, colorSchemeDark, colorSchemeLight, themeQuartz } from "ag-grid-community";
import { useMemo, useSyncExternalStore } from "react";

ModuleRegistry.registerModules([AllCommunityModule]);

function subscribeDark(callback: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

/** The Tollgate AG Grid theme, following the system light/dark setting. */
export function useGridTheme() {
  const dark = useSyncExternalStore(
    subscribeDark,
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false,
  );
  return useMemo(
    () =>
      themeQuartz.withPart(dark ? colorSchemeDark : colorSchemeLight).withParams({
        accentColor: "#059669",
        fontFamily: "inherit",
        headerFontWeight: 600,
        wrapperBorderRadius: 12,
      }),
    [dark],
  );
}
