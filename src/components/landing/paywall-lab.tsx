"use client";

import { useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  ARTICLE_BODY,
  ARTICLE_ROWS,
  ARTICLE_TEASER,
  ARTICLE_TITLE,
  DEFAULT_COLS,
  GLYPHS,
  LH,
  REQUEST_LINES,
  REQUEST_STEPS,
  articleNoise,
  lineOpacity,
  noiseRows,
  randomGlyph,
  requestNoise,
  scrambleLine,
  slitDistance,
  wrapArticle,
} from "./paywall-lab-data";

const TORCH_R = 72; // px
const DECODE_MS = 1200;
const NOISE_TICK_MS = 100; // noise re-rolls at ~10 fps; movement stays at display rate

/**
 * Runs `frame` on requestAnimationFrame while `el` is on screen and the tab is visible.
 * `frame` returns false to idle until the next `kick()` (used for reduced motion and
 * finished animations), so nothing runs when nothing changes.
 */
function startEngine(el: HTMLElement, frame: (now: number, dt: number, resumed: boolean) => boolean) {
  let raf = 0;
  let last = 0;
  let inView = false;
  const loop = (now: number) => {
    raf = 0;
    const resumed = last === 0;
    const dt = resumed ? 16 : Math.min(64, now - last);
    last = now;
    if (frame(now, dt, resumed) && inView && document.visibilityState === "visible") raf = requestAnimationFrame(loop);
    else last = 0;
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(loop);
  };
  const io = new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      if (inView) kick();
    },
    { rootMargin: "120px 0px" },
  );
  io.observe(el);
  const onVisibility = () => {
    if (document.visibilityState === "visible") kick();
  };
  document.addEventListener("visibilitychange", onVisibility);
  return {
    kick,
    stop() {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(raf);
    },
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * "Paywall lab": the 402 exchange read through a draggable slit, beside an article that is
 * pure noise to a bot except for the teaser under a torch, until it pays.
 */
export function PaywallLab({ className = "" }: { className?: string }) {
  return (
    <div className={`grid gap-3 lg:grid-cols-2 ${className}`}>
      <RequestPanel />
      <ArticlePanel />
    </div>
  );
}

function Panel({ label, hint, children, footer }: { label: string; hint: string; children: ReactNode; footer: ReactNode }) {
  return (
    <section
      aria-label={label.charAt(0) + label.slice(1).toLowerCase()}
      className="flex min-w-0 flex-col rounded-xl border border-zinc-200 bg-zinc-50 font-mono text-[11px] sm:text-xs lg:text-[11.5px] dark:border-zinc-800/80 dark:bg-zinc-950"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pt-4 sm:px-5 sm:pt-5">
        <span aria-hidden className="tracking-[0.18em] whitespace-pre text-emerald-700 dark:text-emerald-400">
          [ {label} ]
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">{hint}</span>
      </header>
      <div className="min-w-0 px-4 pt-5 sm:px-5">{children}</div>
      <div className="mt-auto px-4 pt-5 sm:px-5">
        <div className="border-t border-dotted border-zinc-300 dark:border-zinc-700/70" />
      </div>
      <div className="px-4 pt-3 pb-4 leading-5 sm:px-5 sm:pb-5">{footer}</div>
    </section>
  );
}

/* ---------------------------------- [ REQUEST ] ---------------------------------- */

function RequestPanel() {
  const reduce = useReducedMotion() ?? false;
  const [step, setStep] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const rowEls = useRef<(HTMLDivElement | null)[]>([]);
  const textEls = useRef<(HTMLSpanElement | null)[]>([]);
  // Live, per-frame state lives in a ref; React state only holds the step (footer + ARIA).
  const ctl = useRef({
    top: 0, // slit top, in lines (float while it moves)
    h: 2, // slit height, in lines
    tTop: 0,
    tH: 2,
    step: 0,
    dragging: false,
    grab: 0,
    hover: false,
    focus: false,
    lastInteract: -1e9,
    lastAdvance: 0,
    kick: () => {},
  });

  // First frame (server and client alike): seeded scramble around step 1.
  const [initial] = useState(() => {
    const noise = requestNoise();
    return REQUEST_LINES.map((_, i) => {
      const d = slitDistance(i, 0, 2);
      return { text: scrambleLine(i, d, noise), d };
    });
  });

  const goTo = useCallback((i: number, byUser: boolean) => {
    const c = ctl.current;
    const s = REQUEST_STEPS[i];
    c.step = i;
    c.tTop = s.from;
    c.tH = s.to - s.from + 1;
    if (byUser) c.lastInteract = performance.now();
    setStep(i);
    c.kick();
  }, []);

  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    const c = ctl.current;
    const noise = requestNoise();
    const cache: string[] = [];
    let lastTick = 0;

    const paint = () => {
      for (let i = 0; i < REQUEST_LINES.length; i++) {
        const d = slitDistance(i, c.top, c.h);
        const text = scrambleLine(i, d, noise);
        const t = textEls.current[i];
        if (!t) continue;
        if (cache[i] !== text) {
          cache[i] = text;
          t.textContent = text;
        }
        t.style.opacity = String(lineOpacity(d));
        rowEls.current[i]?.toggleAttribute("data-crisp", d <= 0);
      }
      const band = bandRef.current;
      if (band) {
        band.style.transform = `translate3d(0, ${c.top * LH}px, 0)`;
        band.style.height = `${c.h * LH}px`;
      }
    };

    const engine = startEngine(el, (now, dt, resumed) => {
      if (reduce) {
        c.top = c.tTop;
        c.h = c.tH;
        paint();
        return false;
      }
      if (resumed) c.lastAdvance = now;
      // Idle: walk through the steps on its own; any interaction pauses it for a while.
      if (!c.dragging && !c.hover && !c.focus && now - c.lastInteract > 6000 && now - c.lastAdvance > 3400) {
        c.lastAdvance = now;
        goTo((c.step + 1) % REQUEST_STEPS.length, false);
      }
      const k = 1 - Math.exp(-dt / 120);
      if (!c.dragging) c.top += (c.tTop - c.top) * k;
      c.h += (c.tH - c.h) * k;
      if (Math.abs(c.tTop - c.top) < 0.002) c.top = c.tTop;
      if (Math.abs(c.tH - c.h) < 0.002) c.h = c.tH;
      if (now - lastTick > NOISE_TICK_MS) {
        lastTick = now;
        for (const g of noise.gly) for (let k2 = 0; k2 < g.length; k2++) if (Math.random() < 0.3) g[k2] = randomGlyph(Math.random());
        cache.length = 0;
      }
      paint();
      return true;
    });
    c.kick = engine.kick;
    return () => {
      engine.stop();
      c.kick = () => {};
    };
  }, [reduce, goTo]);

  const lineAt = (e: PointerEvent) => (e.clientY - (rowsRef.current?.getBoundingClientRect().top ?? 0)) / LH;

  const dragTo = (line: number) => {
    const c = ctl.current;
    const top = clamp(line - c.grab, 0, REQUEST_LINES.length - c.h);
    c.top = c.tTop = top;
    const centre = top + c.h / 2;
    let best = 0;
    REQUEST_STEPS.forEach((s, i) => {
      const b = REQUEST_STEPS[best];
      if (Math.abs((s.from + s.to + 1) / 2 - centre) < Math.abs((b.from + b.to + 1) / 2 - centre)) best = i;
    });
    if (best !== c.step) {
      const s = REQUEST_STEPS[best];
      c.step = best;
      c.tH = s.to - s.from + 1;
      setStep(best);
    }
    c.lastInteract = performance.now();
    c.kick();
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const c = ctl.current;
    e.currentTarget.setPointerCapture(e.pointerId);
    c.dragging = true;
    const line = lineAt(e);
    c.grab = line >= c.top && line <= c.top + c.h ? line - c.top : c.h / 2;
    dragTo(line);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (ctl.current.dragging) dragTo(lineAt(e));
  };
  const endDrag = () => {
    const c = ctl.current;
    if (!c.dragging) return;
    c.dragging = false;
    goTo(c.step, true); // snap to the step's lines
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const cur = ctl.current.step;
    const last = REQUEST_STEPS.length - 1;
    const next =
      e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === "PageDown"
        ? Math.min(last, cur + 1)
        : e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "PageUp"
          ? Math.max(0, cur - 1)
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    e.preventDefault();
    goTo(next, true);
  };

  const s = REQUEST_STEPS[step];

  return (
    <Panel
      label="REQUEST"
      hint="drag the slit · each line is one step"
      footer={
        <>
          <p className="min-h-[2lh] text-zinc-700 dark:text-zinc-300">{s.note}</p>
          <div className="mt-1 flex justify-between gap-4 text-zinc-500 dark:text-zinc-400">
            <span aria-hidden className="min-w-0 truncate">
              c(i) = i ∈ slit ? src(i) : noise(i, d)
            </span>
            <span className="shrink-0 tabular-nums">
              lines {s.from + 1}–{s.to + 1} · step {step + 1} / {REQUEST_STEPS.length}
            </span>
          </div>
        </>
      }
    >
      <pre className="sr-only">{REQUEST_LINES.join("\n")}</pre>
      <div
        ref={sliderRef}
        role="slider"
        tabIndex={0}
        aria-label="Exchange step"
        aria-valuemin={1}
        aria-valuemax={REQUEST_STEPS.length}
        aria-valuenow={step + 1}
        aria-valuetext={`Step ${step + 1} of ${REQUEST_STEPS.length}, ${s.name}: ${s.note}`}
        onKeyDown={onKeyDown}
        onFocus={(e) => {
          ctl.current.focus = e.currentTarget.matches(":focus-visible");
        }}
        onBlur={() => {
          ctl.current.focus = false;
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") ctl.current.hover = true;
        }}
        onPointerLeave={() => {
          ctl.current.hover = false;
        }}
        className="relative -mx-2 cursor-ns-resize touch-pan-x rounded-md px-2 select-none outline-offset-2 focus-visible:outline-2 focus-visible:outline-emerald-500"
      >
        <div
          ref={bandRef}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[36px] border-y border-dashed border-emerald-600/45 bg-emerald-500/[0.07] will-change-transform dark:border-emerald-400/35 dark:bg-emerald-400/[0.06]"
        />
        <div ref={rowsRef} aria-hidden className="relative overflow-x-auto [scrollbar-width:none]">
          <div className="w-max min-w-full">
            {initial.map((line, i) => (
              <div
                key={i}
                ref={(el) => {
                  rowEls.current[i] = el;
                }}
                data-crisp={line.d <= 0 ? "" : undefined}
                className="group flex h-[18px] leading-[18px]"
              >
                <span className="w-[2ch] shrink-0 text-right text-zinc-400 tabular-nums group-data-[crisp]:text-emerald-700 dark:text-zinc-600 dark:group-data-[crisp]:text-emerald-400">
                  {i + 1}
                </span>
                <span
                  ref={(el) => {
                    textEls.current[i] = el;
                  }}
                  style={{ opacity: lineOpacity(line.d) }}
                  className="ml-[2ch] whitespace-pre text-zinc-500 group-data-[crisp]:text-zinc-900 dark:text-zinc-500 dark:group-data-[crisp]:text-zinc-100"
                >
                  {line.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ---------------------------------- [ ARTICLE ] ---------------------------------- */

type Layer = "base" | "halo" | "lit";
const LAYERS: { id: Layer; className: string }[] = [
  { id: "base", className: "text-zinc-400/80 dark:text-zinc-700" },
  { id: "halo", className: "text-emerald-700/70 dark:text-emerald-400/65" },
  { id: "lit", className: "text-zinc-950 dark:text-zinc-50" },
];

function ArticlePanel() {
  const reduce = useReducedMotion() ?? false;
  const [cols, setCols] = useState(DEFAULT_COLS);
  const [paid, setPaid] = useState(false);
  const [announce, setAnnounce] = useState("");
  const grid = useMemo(() => wrapArticle(cols), [cols]);
  const initialRows = useMemo(() => noiseRows(articleNoise(cols), cols), [cols]);

  const boxRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const lampRef = useRef<SVGSVGElement>(null);
  const litRef = useRef<HTMLSpanElement>(null);
  const readRef = useRef<HTMLSpanElement>(null);
  const layerEls = useRef<Record<Layer, (HTMLDivElement | null)[]>>({ base: [], halo: [], lit: [] });
  const ctl = useRef({
    paid: false,
    decodeStart: 0,
    dirty: true,
    x: -1, // torch centre, px within the grid
    y: -1,
    tx: 0,
    ty: 0,
    manual: false, // following the pointer (else wandering)
    touch: false,
    pressed: false,
    lastMove: 0,
    width: 0,
    charW: 7.2,
    kick: () => {},
  });

  // Columns follow the box width, so the text re-wraps instead of overflowing; rows stay fixed.
  useEffect(() => {
    const box = boxRef.current;
    const m = measureRef.current;
    if (!box || !m) return;
    const measure = () => {
      const c = ctl.current;
      c.width = box.clientWidth;
      c.charW = m.getBoundingClientRect().width / 10 || 7.2;
      c.dirty = true;
      setCols(clamp(Math.floor(c.width / c.charW), 24, 80));
      c.kick();
    };
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    ro.observe(m);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const c = ctl.current;
    c.width = box.clientWidth || c.width;
    c.dirty = true;
    const noise = articleNoise(cols); // matches the server-rendered first frame
    const cache: Record<Layer, (string | undefined)[]> = { base: [], halo: [], lit: [] };
    let lastTick = 0;
    let lastX = NaN;
    let lastY = NaN;

    const write = (layer: Layer, r: number, s: string) => {
      if (cache[layer][r] === s) return;
      cache[layer][r] = s;
      const el = layerEls.current[layer][r];
      if (el) el.textContent = s;
    };
    const stats = (lit: number) => {
      if (litRef.current) litRef.current.textContent = String(lit);
      if (readRef.current) readRef.current.textContent = String(Math.round((lit / grid.total) * 100));
    };

    // Returns true while the decode sweep is still running.
    const paint = (now: number) => {
      let lit = 0;
      if (c.paid) {
        const p = reduce ? 1 : Math.min(1, (now - c.decodeStart) / DECODE_MS);
        const e = 1 - (1 - p) ** 3;
        for (let r = 0; r < ARTICLE_ROWS; r++) {
          const row = grid.rows[r];
          let b = "";
          let l = "";
          for (let col = 0; col < cols; col++) {
            const i = r * cols + col;
            const t = ((col / cols) * 0.8 + (r / ARTICLE_ROWS) * 0.2 + noise.jit[i] * 0.15) / 1.15;
            if (p >= 1 || t < e) {
              l += row[col];
              b += " ";
              if (row[col] !== " ") lit++;
            } else {
              l += " ";
              b += GLYPHS[noise.gly[i]];
            }
          }
          write("base", r, b);
          write("halo", r, "");
          write("lit", r, l);
        }
        stats(lit);
        return p < 1;
      }

      const R2 = TORCH_R * TORCH_R;
      const inner = TORCH_R * 0.72;
      for (let r = 0; r < ARTICLE_ROWS; r++) {
        const row = grid.rows[r];
        const dy = (r + 0.5) * LH - c.y;
        let b = "";
        let h = "";
        let l = "";
        for (let col = 0; col < cols; col++) {
          const i = r * cols + col;
          const g = GLYPHS[noise.gly[i]];
          const dx = (col + 0.5) * c.charW - c.x;
          const d2 = dx * dx + dy * dy;
          if (d2 >= R2) {
            b += g;
            h += " ";
            l += " ";
            continue;
          }
          // Inside the torch only the teaser resolves, with a soft, grainy edge.
          const d = Math.sqrt(d2);
          const show = grid.teaser[i] === 1 && (d < inner || noise.jit[i] < (TORCH_R - d) / (TORCH_R - inner));
          b += " ";
          if (show) {
            h += " ";
            l += row[col];
            if (row[col] !== " ") lit++;
          } else {
            h += g;
            l += " ";
          }
        }
        write("base", r, b);
        write("halo", r, h);
        write("lit", r, l);
      }
      stats(lit);
      return false;
    };

    const wander = (now: number) =>
      reduce
        ? { x: c.width * 0.3, y: grid.teaserMid * LH }
        : { x: c.width * (0.5 + 0.36 * Math.sin(now / 2600)), y: grid.teaserMid * LH + LH * 1.1 * Math.sin(now / 1700) };

    const engine = startEngine(box, (now, dt) => {
      if (c.touch && !c.pressed && now - c.lastMove > 4000) c.manual = false;
      const t = c.manual ? { x: c.tx, y: c.ty } : wander(now);
      if (reduce || c.x < 0) {
        c.x = t.x;
        c.y = t.y;
      } else {
        const k = 1 - Math.exp(-dt / (c.manual ? 45 : 260));
        c.x += (t.x - c.x) * k;
        c.y += (t.y - c.y) * k;
      }
      if (Math.abs(c.x - lastX) > 0.3 || Math.abs(c.y - lastY) > 0.3) {
        lastX = c.x;
        lastY = c.y;
        const tr = `translate3d(${c.x - TORCH_R}px, ${c.y - TORCH_R}px, 0)`;
        if (glowRef.current) glowRef.current.style.transform = tr;
        if (lampRef.current) lampRef.current.style.transform = tr;
        if (!c.paid) c.dirty = true;
      }
      if (!reduce && !c.paid && now - lastTick > NOISE_TICK_MS) {
        lastTick = now;
        for (let i = 0; i < noise.gly.length; i++) if (Math.random() < 0.2) noise.gly[i] = randomGlyph(Math.random());
        c.dirty = true;
      }
      if (c.paid) {
        const decoding = paint(now);
        c.dirty = false;
        return decoding && !reduce;
      }
      if (c.dirty) {
        paint(now);
        c.dirty = false;
      }
      return !reduce;
    });
    c.kick = engine.kick;
    return () => {
      engine.stop();
      c.kick = () => {};
    };
  }, [reduce, grid, cols]);

  const aim = (e: PointerEvent<HTMLDivElement>) => {
    const c = ctl.current;
    const r = e.currentTarget.getBoundingClientRect();
    c.tx = e.clientX - r.left;
    c.ty = e.clientY - r.top;
    c.manual = true;
    c.touch = e.pointerType !== "mouse";
    c.lastMove = performance.now();
    c.kick();
  };

  const onPay = () => {
    const c = ctl.current;
    if (c.paid) {
      c.paid = false;
      setPaid(false);
      setAnnounce("Reset. The article is locked again; only the teaser is available.");
    } else {
      c.paid = true;
      c.decodeStart = performance.now();
      setPaid(true);
      setAnnounce("Paid 24 cents. 200 OK: the full article is unlocked.");
    }
    c.dirty = true;
    c.kick();
  };

  return (
    <Panel
      label="ARTICLE"
      hint="move the torch · pay to read"
      footer={
        <>
          <div className="flex min-h-[2lh] items-start justify-between gap-3">
            {paid ? (
              <p className="text-emerald-700 dark:text-emerald-400">200 OK · access_token · read 100%</p>
            ) : (
              <p className="text-zinc-700 dark:text-zinc-300">
                402 · teaser only · read <span ref={readRef} className="tabular-nums">0</span>%
              </p>
            )}
            <button
              type="button"
              onClick={onPay}
              className={`-my-1 shrink-0 rounded-full px-3.5 py-1.5 font-sans text-xs font-medium whitespace-nowrap outline-offset-2 focus-visible:outline-2 focus-visible:outline-emerald-500 active:scale-[0.97] motion-safe:transition-[transform,background-color,border-color] motion-safe:duration-150 ${
                paid
                  ? "border border-zinc-300 bg-transparent text-zinc-700 hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
                  : "border border-transparent bg-emerald-700 text-white hover:bg-emerald-600 dark:bg-emerald-400 dark:text-zinc-950 dark:hover:bg-emerald-300"
              }`}
            >
              {paid ? "Reset" : "Pay 24¢"}
            </button>
          </div>
          <div className="mt-1 flex justify-between gap-4 text-zinc-500 dark:text-zinc-400">
            <span aria-hidden className="min-w-0 truncate">
              {paid ? "visible = article" : `visible = teaser ∩ torch(r = ${TORCH_R}px)`}
            </span>
            <span aria-hidden className="shrink-0 tabular-nums">
              lit <span ref={litRef}>0</span> / {grid.total}
            </span>
          </div>
        </>
      }
    >
      <div className="sr-only">
        <p>{ARTICLE_TITLE}</p>
        <p>Teaser: {ARTICLE_TEASER}</p>
        <p>{paid ? ARTICLE_BODY : "Full text available after payment."}</p>
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <div
        ref={boxRef}
        aria-hidden
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" || ctl.current.pressed) aim(e);
        }}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") e.currentTarget.setPointerCapture(e.pointerId);
          ctl.current.pressed = true;
          aim(e);
        }}
        onPointerUp={() => {
          ctl.current.pressed = false;
          ctl.current.lastMove = performance.now();
        }}
        onPointerCancel={() => {
          ctl.current.pressed = false;
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") {
            ctl.current.manual = false;
            ctl.current.kick();
          }
        }}
        className={`relative h-[270px] touch-none overflow-hidden leading-[18px] select-none ${paid ? "" : "cursor-crosshair"}`}
      >
        <span ref={measureRef} className="pointer-events-none invisible absolute top-0 left-0 whitespace-pre">
          {"0".repeat(10)}
        </span>
        <div
          ref={glowRef}
          style={{ transform: `translate3d(40px, ${3 * LH - TORCH_R}px, 0)` }}
          className={`pointer-events-none absolute top-0 left-0 size-[144px] rounded-full bg-[radial-gradient(closest-side,rgb(16_185_129/0.16),transparent)] will-change-transform motion-safe:transition-opacity motion-safe:duration-300 dark:bg-[radial-gradient(closest-side,rgb(52_211_153/0.11),transparent)] ${
            paid ? "opacity-0" : "opacity-100"
          }`}
        />
        {LAYERS.map((layer) => (
          <div key={layer.id} className={`absolute inset-0 ${layer.className}`}>
            {Array.from({ length: ARTICLE_ROWS }, (_, r) => (
              <div
                key={r}
                ref={(el) => {
                  layerEls.current[layer.id][r] = el;
                }}
                className="h-[18px] whitespace-pre"
              >
                {layer.id === "base" ? initialRows[r] : ""}
              </div>
            ))}
          </div>
        ))}
        <svg
          ref={lampRef}
          viewBox={`${-TORCH_R} ${-TORCH_R} ${TORCH_R * 2} ${TORCH_R * 2}`}
          style={{ transform: `translate3d(40px, ${3 * LH - TORCH_R}px, 0)` }}
          className={`pointer-events-none absolute top-0 left-0 size-[144px] text-emerald-600 will-change-transform motion-safe:transition-opacity motion-safe:duration-300 dark:text-emerald-400 ${
            paid ? "opacity-0" : "opacity-100"
          }`}
        >
          <circle r={TORCH_R - 1} fill="none" stroke="currentColor" strokeOpacity={0.22} strokeDasharray="1 5" />
          {Array.from({ length: 8 }, (_, k) => {
            const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
            return (
              <line
                key={k}
                x1={+(Math.cos(a) * 10).toFixed(2)}
                y1={+(Math.sin(a) * 10).toFixed(2)}
                x2={+(Math.cos(a) * (TORCH_R - 8)).toFixed(2)}
                y2={+(Math.sin(a) * (TORCH_R - 8)).toFixed(2)}
                stroke="currentColor"
                strokeOpacity={0.2}
                strokeDasharray="1 4"
                strokeLinecap="round"
              />
            );
          })}
          <circle r={5} fill="none" stroke="currentColor" strokeOpacity={0.55} />
          <circle r={2} fill="currentColor" />
        </svg>
      </div>
    </Panel>
  );
}
