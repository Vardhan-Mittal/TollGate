import type { ReactNode } from "react";

// The site's shared look, taken from the landing page, so every page reads as one product.
// Plain components and class strings (no hooks): usable from server and client components.

/** Class strings for the recurring pieces. */
export const ui = {
  /** Main call to action: dark pill in light mode, white pill in dark mode. */
  btnPrimary:
    "inline-flex items-center justify-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-[0_8px_24px_rgb(0_0_0/0.14)] transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:shadow-[0_0_28px_rgb(255_255_255/0.10)] dark:hover:bg-white",
  /** Actions that move money or start an agent: emerald pill. */
  btnAccent:
    "inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400",
  /** Secondary action: hairline outline pill. */
  btnSecondary:
    "inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white/60 px-5 py-2.5 text-sm font-medium transition-colors hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20",
  /** Small toggle/choice pill (budgets, filters). Add `uiChipActive` when selected. */
  chip: "rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-white/10 dark:text-zinc-400 dark:hover:border-white/20 dark:hover:text-zinc-100",
  chipActive: "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900",
  /** Panels and cards: hairline border, barely-there fill, generous radius. */
  card: "rounded-2xl border border-zinc-200 bg-white/70 dark:border-white/10 dark:bg-white/[0.02]",
  /** A quieter inset surface inside a card (stat tiles, code, rows). */
  inset: "rounded-xl border border-zinc-200/70 bg-zinc-50 dark:border-white/[0.06] dark:bg-white/[0.03]",
  /** Text inputs, textareas and selects. */
  input:
    "w-full rounded-xl border border-zinc-200 bg-white/70 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-white/[0.03] dark:placeholder:text-zinc-500",
  /** Small uppercase mono label above a section or field group. */
  label: "font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500",
  /** Muted body copy. */
  muted: "text-zinc-600 dark:text-zinc-400",
};

/** Page frame: the landing page's quiet dot-grid backdrop and consistent padding. */
export function PageShell({ children, width = "5xl" }: { children: ReactNode; width?: "3xl" | "4xl" | "5xl" | "6xl" | "7xl" }) {
  const max = { "3xl": "max-w-3xl", "4xl": "max-w-4xl", "5xl": "max-w-5xl", "6xl": "max-w-6xl", "7xl": "max-w-7xl" }[width];
  return (
    <main className={`relative mx-auto w-full ${max} overflow-x-clip px-4 pb-16 pt-8 sm:pt-12`}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-[520px] bg-dot-grid" />
      {children}
    </main>
  );
}

/**
 * Page title block, matching the landing hero: a mono eyebrow pill, a sheen headline with an
 * optional serif-italic accent, a muted lead paragraph and optional actions.
 */
export function PageHeader({
  eyebrow,
  title,
  accent,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  accent?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="motion-safe:animate-rise">
      {eyebrow && (
        <p className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/60 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {eyebrow}
        </p>
      )}
      <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-[1.05] tracking-[-0.035em] text-balance sm:text-5xl">
        <span className="text-sheen">{title}</span>
        {accent && (
          <>
            {" "}
            <span className="font-serif text-[1.08em] font-normal italic tracking-[-0.01em] text-emerald-600 dark:text-emerald-400">{accent}</span>
          </>
        )}
      </h1>
      {description && <p className={`mt-4 max-w-2xl text-base text-pretty sm:text-lg ${ui.muted}`}>{description}</p>}
      {actions && <div className="mt-6 flex flex-wrap gap-3">{actions}</div>}
    </header>
  );
}

/** Small mono section label with an optional right-aligned aside (e.g. a link or a count). */
export function SectionLabel({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className={ui.label}>{children}</h2>
      {aside && <div className="text-xs text-zinc-500">{aside}</div>}
    </div>
  );
}
