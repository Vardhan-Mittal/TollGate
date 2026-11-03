/**
 * A small "AI is thinking" orb: a slowly swirling emerald-teal sphere that breathes.
 * Pure CSS, so it costs nothing to run; it holds still under reduced motion.
 */
export function ThinkingOrb({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <span aria-hidden className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      {/* The swirl: a conic gradient spinning under a soft blur. */}
      <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#10b981,#2dd4bf,#d1fae5,#0f766e,#10b981)] opacity-90 blur-[1px] motion-safe:animate-[spin_2.6s_linear_infinite]" />
      {/* A glassy core that breathes, so the orb seems to pulse from inside. */}
      <span className="absolute inset-[22%] rounded-full bg-white/55 backdrop-blur-[1px] motion-safe:animate-[orb-breathe_1.8s_ease-in-out_infinite] dark:bg-zinc-950/45" />
      {/* Specular highlight. */}
      <span className="absolute left-[20%] top-[16%] h-[28%] w-[28%] rounded-full bg-white/80 blur-[0.5px]" />
    </span>
  );
}
