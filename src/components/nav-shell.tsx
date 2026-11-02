"use client";

import { useMotionValueEvent, useScroll } from "motion/react";
import { useState, type ReactNode } from "react";

/**
 * The header frame: a full-width, borderless bar at the top of the page that
 * folds into a floating frosted pill once the page scrolls.
 */
export function NavShell({ children }: { children: ReactNode }) {
  const { scrollY } = useScroll();
  const [floating, setFloating] = useState(false);

  // Two thresholds, so the bar doesn't flicker when scrolling right around one point.
  useMotionValueEvent(scrollY, "change", (y) => {
    if (!floating && y > 24) setFloating(true);
    else if (floating && y < 8) setFloating(false);
  });

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 px-3 sm:px-4">
        <div
          data-floating={floating || undefined}
          className={`mx-auto flex items-center gap-x-5 whitespace-nowrap text-sm transition-[max-width,margin,padding,border-radius,background-color,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
            floating
              ? "mt-3 max-w-4xl rounded-full border border-zinc-200/80 bg-white/75 py-2 pl-4 pr-2 shadow-[0_8px_30px_rgb(0_0_0/0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/70 dark:shadow-[0_8px_30px_rgb(0_0_0/0.45)]"
              : "mt-0 max-w-6xl rounded-none border border-transparent bg-transparent px-1 py-4"
          }`}
        >
          {children}
        </div>
      </header>
      {/* Holds the header's place in the page, since the header itself is fixed. */}
      <div aria-hidden className="h-[68px]" />
    </>
  );
}
