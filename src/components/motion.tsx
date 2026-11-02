"use client";

import { MotionConfig, animate, motion, useInView, useMotionValue, useTransform, type HTMLMotionProps } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";

// One gentle spring for the whole site, so every animation settles the same way.
export const SPRING = { type: "spring", stiffness: 260, damping: 26 } as const;

/** Honours the visitor's "reduce motion" setting everywhere below it. */
export function MotionProvider({ children }: { children: ReactNode }) {
  // Tells globals.css that Motion is running, which turns off the reveal failsafe.
  useEffect(() => {
    document.documentElement.dataset.hydrated = "";
  }, []);
  return <MotionConfig reducedMotion="user" transition={SPRING}>{children}</MotionConfig>;
}

/**
 * Fades and lifts its children in the first time they scroll into view.
 * For below-the-fold content only: it server-renders hidden, so above-the-fold
 * content should use the CSS `animate-rise` entrance instead. `data-reveal`
 * lets globals.css show it anyway when JavaScript is off or fails.
 */
export function Reveal({ delay = 0, className, children }: { delay?: number; className?: string; children: ReactNode }) {
  return (
    <motion.div
      data-reveal
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ ...SPRING, delay }}
    >
      {children}
    </motion.div>
  );
}

const group = { hidden: {}, shown: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, shown: { opacity: 1, y: 0, transition: SPRING } };

/** A list whose items arrive one after another when it scrolls into view. */
export function Stagger({ as = "div", className, children }: { as?: "div" | "ol" | "ul" | "dl"; className?: string; children: ReactNode }) {
  const Tag = motion[as];
  return (
    <Tag className={className} variants={group} initial="hidden" whileInView="shown" viewport={{ once: true, margin: "-60px" }}>
      {children}
    </Tag>
  );
}

export function StaggerItem({ as = "div", ...props }: { as?: "div" | "li" } & HTMLMotionProps<"div">) {
  const Tag = motion[as] as typeof motion.div;
  return <Tag data-reveal variants={item} {...props} />;
}

/** A card that lifts slightly under the pointer. */
export function Lift({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <motion.div className={className} whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}>
      {children}
    </motion.div>
  );
}

/**
 * Counts up to `value` when first seen, then glides to each new value.
 * Props stay plain data so server components can render it too.
 */
export function CountUp({ value, prefix = "", decimals = 0 }: { value: number; prefix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  const count = useMotionValue(0);
  const text = useTransform(
    count,
    (n) => prefix + n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
  );

  useEffect(() => {
    if (!seen) return;
    const controls = animate(count, value, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [seen, value, count]);

  return <motion.span ref={ref}>{text}</motion.span>;
}
