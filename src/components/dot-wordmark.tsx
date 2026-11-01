"use client";

import { useEffect, useRef } from "react";

const PUSH_RADIUS = 90; // CSS px around the pointer that scatters dots
const SPRING_K = 0.045; // pull back toward home
const DAMPING = 0.84;
const EMERALD = [16, 185, 129];
const LIGHT_REST = [161, 161, 170, 0.7]; // zinc-400
const DARK_REST = [88, 88, 98, 0.75]; // between zinc-500 and zinc-600
const BUCKETS = 8; // colour steps, so a frame is a few fills instead of one per dot

/** "tollgate" drawn as a field of dots that scatter from the pointer and spring home. */
export function DotWordmark({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const darkQuery = matchMedia("(prefers-color-scheme: dark)");
    let dark = darkQuery.matches;

    let disposed = false;
    let ready = false;
    let visible = true;
    let raf = 0;
    let dpr = 1;
    let radius = 1;
    let count = 0;
    let home = new Float32Array(0);
    let pos = new Float32Array(0);
    let vel = new Float32Array(0);
    let pointer: { x: number; y: number } | null = null;
    let settled = false;
    const buckets: number[][] = Array.from({ length: BUCKETS }, () => []);

    // Render the word offscreen and keep a dot wherever the glyphs are solid.
    function build() {
      if (!canvas || !ctx) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      canvas.width = w;
      canvas.height = h;

      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const octx = off.getContext("2d", { willReadFrequently: true });
      if (!octx) return;
      const family = getComputedStyle(canvas).fontFamily;
      octx.font = `800 100px ${family}`;
      const probe = octx.measureText("tollgate");
      const size = Math.min((100 * w * 0.95) / probe.width, h * 0.95);
      octx.font = `800 ${size}px ${family}`;
      octx.textAlign = "center";
      octx.textBaseline = "alphabetic";
      const m = octx.measureText("tollgate");
      const glyphH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      octx.fillStyle = "#000";
      octx.fillText("tollgate", w / 2, (h - glyphH) / 2 + m.actualBoundingBoxAscent);

      const data = octx.getImageData(0, 0, w, h).data;
      const step = Math.max(4, w / 220);
      radius = step * 0.36;
      const pts: number[] = [];
      for (let y = step / 2; y < h; y += step) {
        for (let x = step / 2; x < w; x += step) {
          if (data[((y | 0) * w + (x | 0)) * 4 + 3] > 140) pts.push(x, y);
        }
      }
      home = Float32Array.from(pts);
      pos = Float32Array.from(pts);
      vel = new Float32Array(pts.length);
      count = pts.length / 2;
      settled = false;
      ready = true;
    }

    function colour(t: number) {
      const rest = dark ? DARK_REST : LIGHT_REST;
      const r = Math.round(rest[0] + (EMERALD[0] - rest[0]) * t);
      const g = Math.round(rest[1] + (EMERALD[1] - rest[1]) * t);
      const b = Math.round(rest[2] + (EMERALD[2] - rest[2]) * t);
      return `rgba(${r},${g},${b},${rest[3] + (1 - rest[3]) * t})`;
    }

    function draw() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const full = 18 * dpr; // displacement at which a dot is fully emerald
      for (const b of buckets) b.length = 0;
      for (let i = 0; i < count; i++) {
        const dx = pos[i * 2] - home[i * 2];
        const dy = pos[i * 2 + 1] - home[i * 2 + 1];
        const t = Math.min(1, Math.sqrt(dx * dx + dy * dy) / full);
        buckets[Math.min(BUCKETS - 1, Math.round(t * (BUCKETS - 1)))].push(i);
      }
      for (let k = 0; k < BUCKETS; k++) {
        const list = buckets[k];
        if (!list.length) continue;
        ctx.fillStyle = colour(k / (BUCKETS - 1));
        ctx.beginPath();
        for (const i of list) {
          const x = pos[i * 2];
          const y = pos[i * 2 + 1];
          ctx.moveTo(x + radius, y);
          ctx.arc(x, y, radius, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }

    function step() {
      const r = PUSH_RADIUS * dpr;
      let energy = 0;
      for (let i = 0; i < count; i++) {
        const ix = i * 2;
        const iy = ix + 1;
        if (pointer) {
          const dx = pos[ix] - pointer.x;
          const dy = pos[iy] - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < r * r && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const force = (1 - d / r) ** 2 * 9 * dpr;
            vel[ix] += (dx / d) * force;
            vel[iy] += (dy / d) * force;
          }
        }
        vel[ix] = (vel[ix] + (home[ix] - pos[ix]) * SPRING_K) * DAMPING;
        vel[iy] = (vel[iy] + (home[iy] - pos[iy]) * SPRING_K) * DAMPING;
        pos[ix] += vel[ix];
        pos[iy] += vel[iy];
        energy += Math.abs(vel[ix]) + Math.abs(vel[iy]) + 0.1 * (Math.abs(home[ix] - pos[ix]) + Math.abs(home[iy] - pos[iy]));
      }
      return energy;
    }

    function frame() {
      raf = 0;
      if (disposed || !visible || !ready) return;
      const energy = step();
      draw();
      // Stop looping once everything has come to rest and nothing is pushing.
      settled = !pointer && energy < count * 0.002;
      if (!settled) raf = requestAnimationFrame(frame);
    }

    function wake() {
      settled = false;
      if (!raf && visible && !reduced) raf = requestAnimationFrame(frame);
    }

    function render() {
      if (reduced) draw();
      else wake();
    }

    function onMove(e: PointerEvent) {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      pointer = { x: (e.clientX - rect.left) * dpr, y: (e.clientY - rect.top) * dpr };
      wake();
    }

    function onLeave() {
      pointer = null;
      wake();
    }

    function onScheme(e: MediaQueryListEvent) {
      dark = e.matches;
      if (ready) draw();
    }

    const resize = new ResizeObserver(() => {
      if (disposed) return;
      build();
      render();
    });

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !settled) wake();
    });

    document.fonts.ready.then(() => {
      if (disposed) return;
      build();
      draw();
      resize.observe(canvas);
      io.observe(canvas);
    });

    darkQuery.addEventListener("change", onScheme);
    if (!reduced) {
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerdown", onMove);
      canvas.addEventListener("pointerleave", onLeave);
      canvas.addEventListener("pointercancel", onLeave);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resize.disconnect();
      io.disconnect();
      darkQuery.removeEventListener("change", onScheme);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointercancel", onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} role="img" aria-label="Tollgate" className={`block aspect-[4.4/1] w-full ${className}`} />;
}
