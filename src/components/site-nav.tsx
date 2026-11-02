import Link from "next/link";
import { Suspense } from "react";
import { ActiveNavLinks, NavLinks } from "./nav-links";
import { NavShell } from "./nav-shell";

// The header prerenders with plain links; which page is active is only known at
// request time, so that part streams in behind a Suspense boundary.
export function SiteNav() {
  return (
    <NavShell>
      <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
        <GateMark />
        Tollgate
      </Link>

      {/* On phones the links scroll sideways instead of wrapping. */}
      <nav
        aria-label="Main"
        className="flex min-w-0 flex-1 items-center gap-x-1 overflow-x-auto [mask-image:linear-gradient(to_right,#000_80%,transparent)] [scrollbar-width:none] md:justify-center md:[mask-image:none] [&::-webkit-scrollbar]:hidden"
      >
        <Suspense fallback={<NavLinks pathname={null} />}>
          <ActiveNavLinks />
        </Suspense>
      </nav>

      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 sm:inline dark:bg-amber-900/40 dark:text-amber-300">
          PayPal sandbox
        </span>
        <Link
          href="/live"
          className="hidden rounded-full bg-zinc-900 px-4 py-1.5 font-medium text-white shadow-sm transition-colors hover:bg-zinc-700 md:inline-block dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Watch an agent pay
        </Link>
      </div>
    </NavShell>
  );
}

/** A small toll-gate mark: two posts and a raised barrier arm. */
function GateMark() {
  return (
    <span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg border border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-900">
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" strokeLinecap="round" strokeWidth="1.6">
        <path d="M3 14V5M13 14V9" className="stroke-zinc-900 dark:stroke-zinc-100" />
        <path d="M3 6 12.5 2.5" className="stroke-emerald-500" />
        <circle cx="13" cy="7.2" r="1.2" className="fill-emerald-500" />
      </svg>
    </span>
  );
}
