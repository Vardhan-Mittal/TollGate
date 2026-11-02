"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";

/**
 * One active index for a chart, driven the same way by pointer and keyboard:
 * hover snaps to the nearest slot, arrows step, Home/End jump, Escape clears.
 * Focus with no prior selection starts on `focusStart`.
 */
export function useCursor(count: number, focusStart: number, slotAt: (fraction: number) => number) {
  const [active, setActive] = useState<number | null>(null);
  const clamp = (i: number) => Math.max(0, Math.min(count - 1, i));

  return {
    active,
    setActive,
    handlers: {
      tabIndex: 0,
      onPointerMove(e: PointerEvent<HTMLElement>) {
        const box = e.currentTarget.getBoundingClientRect();
        setActive(clamp(slotAt((e.clientX - box.left) / box.width)));
      },
      onPointerLeave() {
        setActive(null);
      },
      onFocus() {
        setActive((a) => a ?? clamp(focusStart));
      },
      onBlur() {
        setActive(null);
      },
      onKeyDown(e: KeyboardEvent<HTMLElement>) {
        const step: Record<string, (a: number) => number> = {
          ArrowLeft: (a) => a - 1,
          ArrowRight: (a) => a + 1,
          Home: () => 0,
          End: () => count - 1,
        };
        if (e.key === "Escape") return setActive(null);
        const move = step[e.key];
        if (!move) return;
        e.preventDefault();
        setActive((a) => clamp(move(a ?? focusStart)));
      },
    },
  };
}
