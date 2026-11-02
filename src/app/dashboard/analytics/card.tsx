import type { ReactNode } from "react";

/** Shared shell: icon + title + mono subtitle, a mono headline with an accent unit, then the plot. */
export function AnalyticsCard({
  icon,
  title,
  subtitle,
  value,
  unit,
  children,
  labelledBy,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  value?: ReactNode;
  unit?: ReactNode;
  children: ReactNode;
  labelledBy: string;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className="flex min-w-0 flex-col rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
    >
      <header className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className="mt-px grid size-6 shrink-0 place-items-center rounded-md border border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h3 id={labelledBy} className="text-sm font-medium leading-6">
            {title}
          </h3>
          <p className="font-mono text-xs text-pretty text-zinc-500">{subtitle}</p>
        </div>
      </header>
      {value !== undefined && (
        <p className="mt-4 flex flex-wrap items-baseline gap-x-2 font-mono">
          <span className="text-3xl font-medium tracking-tight">{value}</span>
          {unit && <span className="text-xs text-emerald-700 dark:text-emerald-400">{unit}</span>}
        </p>
      )}
      <div className="mt-4 flex-1">{children}</div>
    </section>
  );
}

/** Honest "not enough data" state that keeps the card's height steady. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-32 place-items-center rounded-lg border border-zinc-100 px-4 text-center text-sm text-pretty text-zinc-500 dark:border-zinc-900">
      <p>{children}</p>
    </div>
  );
}

const iconProps = {
  width: 14,
  height: 14,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export const Icons = {
  revenue: (
    <svg {...iconProps}>
      <path d="M2 12.5h3v-3h3v-4h3V3h3" />
      <path d="M2 14.5h12" />
    </svg>
  ),
  decisions: (
    <svg {...iconProps}>
      <path d="M8 2v4M8 6 4 10v4M8 6l4 4v4" />
    </svg>
  ),
  percentiles: (
    <svg {...iconProps}>
      <path d="M2 14c4 0 5-1 6-5s2-7 6-7" />
      <path d="M2 2v12h12" />
    </svg>
  ),
  heatmap: (
    <svg {...iconProps}>
      <circle cx="4" cy="4" r="1.25" />
      <circle cx="8" cy="4" r="1.25" />
      <circle cx="12" cy="4" r="1.25" />
      <circle cx="4" cy="8" r="1.25" />
      <circle cx="8" cy="8" r="1.25" fill="currentColor" />
      <circle cx="12" cy="8" r="1.25" />
      <circle cx="4" cy="12" r="1.25" fill="currentColor" />
      <circle cx="8" cy="12" r="1.25" />
      <circle cx="12" cy="12" r="1.25" />
    </svg>
  ),
};
