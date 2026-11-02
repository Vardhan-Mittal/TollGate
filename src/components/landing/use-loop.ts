"use client";

import { useInView, useReducedMotion } from "motion/react";
import { useEffect, useState, type RefObject } from "react";

/**
 * Steps through a looping illustration, one phase at a time, holding each phase for
 * `durations[phase]` ms. It only runs while `ref` is on screen. It starts on (and,
 * under reduced motion, stays on) `staticPhase`, a complete frame that reads on its own,
 * so the first paint and the no-JavaScript view are never an empty box.
 */
export function useLoop(ref: RefObject<HTMLElement | null>, durations: readonly number[], staticPhase = durations.length - 1) {
  const inView = useInView(ref, { margin: "-40px 0px" });
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(staticPhase);
  const running = inView && !reduce;

  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => setPhase((p) => (p + 1) % durations.length), durations[phase]);
    return () => clearTimeout(id);
  }, [running, phase, durations]);

  return reduce ? staticPhase : phase;
}
