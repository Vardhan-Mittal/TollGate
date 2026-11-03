"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";

// The footer's canvas effects are below the fold on every page, so their code loads only
// when the visitor scrolls near them, not with the page.
const Aurora = dynamic(() => import("./aurora").then((m) => m.Aurora), { ssr: false });
const DotWordmark = dynamic(() => import("./dot-wordmark").then((m) => m.DotWordmark), { ssr: false });

/** Renders `children` once the placeholder comes within ~600px of the viewport. */
function WhenNear({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {near && children}
    </div>
  );
}

export function LazyAurora({ className = "" }: { className?: string }) {
  return (
    <WhenNear className={className}>
      <Aurora className="h-full w-full" />
    </WhenNear>
  );
}

/** Keeps the wordmark's exact footprint while it loads, so nothing shifts. */
export function LazyDotWordmark() {
  return (
    <WhenNear className="aspect-[4.4/1] w-full">
      <DotWordmark />
    </WhenNear>
  );
}
