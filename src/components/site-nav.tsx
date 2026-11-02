import Link from "next/link";
import { Suspense } from "react";
import { ActiveNavLinks, NavLinks } from "./nav-links";

// The header prerenders with plain links; which page is active is only known at
// request time, so that part streams in behind a Suspense boundary.
export function SiteNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-background/80 backdrop-blur dark:border-zinc-800">
      {/* One line on every screen: on phones the links scroll sideways instead of wrapping. */}
      <nav className="mx-auto flex max-w-5xl items-center gap-x-5 overflow-x-auto whitespace-nowrap px-4 py-3 text-sm [scrollbar-width:none] sm:gap-x-6 [&::-webkit-scrollbar]:hidden">
        <Link href="/" className="font-semibold tracking-tight">
          Tollgate
        </Link>
        <Suspense fallback={<NavLinks pathname={null} />}>
          <ActiveNavLinks />
        </Suspense>
        <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
          PayPal sandbox
        </span>
      </nav>
    </header>
  );
}
