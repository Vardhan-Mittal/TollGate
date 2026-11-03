"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Scene, in world units. y is up, the road runs along x, the gate spans z.
// ---------------------------------------------------------------------------

type Box = readonly [x0: number, y0: number, z0: number, x1: number, y1: number, z1: number];

const SLAB: Box = [-0.55, 0, -1.42, 0.55, 0.06, 1.1];
const PILLAR_HINGE: Box = [-0.2, 0.06, -1.0, 0.2, 1.75, -0.66];
const PILLAR_REST: Box = [-0.16, 0.06, 0.66, 0.16, 1.3, 0.92];
const REST_HOOK: Box = [-0.32, 1.22, 0.7, -0.16, 1.3, 0.88];

// The arm sits on the entry face of the hinge pillar and turns about an axis along the road.
const HINGE = [-0.26, 1.37, -0.83] as const;
const ARM: Box = [-0.31, 1.32, -1.34, -0.21, 1.42, 0.88];
const COUNTERWEIGHT: Box = [-0.34, 1.26, -1.34, -0.2, 1.48, -1.12];
const ARM_OPEN = (68 * Math.PI) / 180;

const ROAD_HALF = 0.56; // road edge lines at z = ±ROAD_HALF
const ROAD_END = 4.2; // road fades out by here
const COIN_START = -3.6;
const COIN_STOP = -0.6; // just short of the arm
const COIN_END = 3.6;
const COIN_R = 0.15;
const COIN_Y = 0.22;
const COIN_Z = 0.28; // the far lane, so the near pillar never hides it

const EDGE_STEP = 0.042; // spacing of dots along an edge
const FACE_DENSITY = 55; // dots per square unit on a face

// Camera
const PIVOT = [0, 0.8, -0.15] as const;
const YAW_BASE = (-44 * Math.PI) / 180;
const YAW_AMP = (14 * Math.PI) / 180;
const YAW_PERIOD = 14;
const PITCH = 0.3;
const TILT = (6 * Math.PI) / 180; // pointer parallax
const FOCAL = 14;
const DEPTH_RANGE = 4.8;

const LOOP = 6;
const STILL_T = 2.05; // reduced motion: coin waiting at the gate, arm closed

// Point kinds, each with its own colour ramp.
const EDGE = 0;
const FACE = 1;
const ROAD = 2;
const ARM_EDGE = 3;
const ARM_FACE = 4;
const KINDS = 5;
const LEVELS = 6; // depth steps per kind, so a frame is ~30 fills instead of one per dot

type Rgb = readonly [number, number, number];
const EMERALD_300: Rgb = [110, 231, 183];
const EMERALD_400: Rgb = [52, 211, 153];
const EMERALD_600: Rgb = [5, 150, 105];
const EMERALD_700: Rgb = [4, 120, 87];
const ZINC_400: Rgb = [161, 161, 170];
const ZINC_500: Rgb = [113, 113, 122];

// [colour, alpha far, alpha near] per kind. Kept low on purpose: texture, never a glow behind text.
type Ramp = readonly [Rgb, number, number];
const DARK_RAMPS: readonly Ramp[] = [
  [EMERALD_400, 0.14, 0.58],
  [ZINC_500, 0.1, 0.34],
  [ZINC_500, 0.12, 0.6],
  [EMERALD_400, 0.16, 0.62],
  [ZINC_500, 0.1, 0.34],
];
const LIGHT_RAMPS: readonly Ramp[] = [
  [EMERALD_600, 0.2, 0.62],
  [ZINC_400, 0.16, 0.46],
  [ZINC_400, 0.18, 0.62],
  [EMERALD_600, 0.22, 0.68],
  [ZINC_400, 0.16, 0.46],
];

type Model = {
  count: number;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  kind: Uint8Array;
  weight: Float32Array; // fades the road out at its ends
};

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Dots along every edge of each box, sparse random dots on its faces, plus the road. */
function buildModel(): Model {
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  const kinds: number[] = [];
  const weights: number[] = [];
  const rand = mulberry32(402);
  const add = (x: number, y: number, z: number, k: number, w = 1) => {
    xs.push(x);
    ys.push(y);
    zs.push(z);
    kinds.push(k);
    weights.push(w);
  };

  function box(b: Box, edgeKind: number, faceKind: number) {
    const lo = [b[0], b[1], b[2]];
    const hi = [b[3], b[4], b[5]];
    const corner = (i: number) => [i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]];
    for (let i = 0; i < 8; i++) {
      const c = corner(i);
      add(c[0], c[1], c[2], edgeKind);
    }
    for (const bit of [1, 2, 4]) {
      for (let i = 0; i < 8; i++) {
        if (i & bit) continue;
        const a = corner(i);
        const e = corner(i | bit);
        const len = Math.hypot(e[0] - a[0], e[1] - a[1], e[2] - a[2]);
        const n = Math.max(1, Math.round(len / EDGE_STEP));
        for (let s = 1; s < n; s++) {
          const t = s / n;
          add(lerp(a[0], e[0], t), lerp(a[1], e[1], t), lerp(a[2], e[2], t), edgeKind);
        }
      }
    }
    for (let axis = 0; axis < 3; axis++) {
      const u = (axis + 1) % 3;
      const v = (axis + 2) % 3;
      const du = hi[u] - lo[u];
      const dv = hi[v] - lo[v];
      const n = Math.round(du * dv * FACE_DENSITY);
      for (const side of [lo[axis], hi[axis]]) {
        for (let k = 0; k < n; k++) {
          const p = [0, 0, 0];
          p[axis] = side;
          p[u] = lo[u] + du * (0.08 + 0.84 * rand());
          p[v] = lo[v] + dv * (0.08 + 0.84 * rand());
          add(p[0], p[1], p[2], faceKind);
        }
      }
    }
  }

  box(SLAB, EDGE, FACE);
  box(PILLAR_HINGE, EDGE, FACE);
  box(PILLAR_REST, EDGE, FACE);
  box(REST_HOOK, EDGE, FACE);
  box(ARM, ARM_EDGE, ARM_FACE);
  box(COUNTERWEIGHT, ARM_EDGE, ARM_FACE);

  // Road: two solid edge lines and a dashed centre line, fading out at both ends.
  const step = 0.06;
  for (let x = -ROAD_END; x <= ROAD_END; x += step) {
    if (Math.abs(x) < SLAB[3] + 0.04) continue; // the slab carries the road under the gate
    const w = 1 - smoothstep(1.8, ROAD_END, Math.abs(x));
    add(x, 0, -ROAD_HALF, ROAD, w);
    add(x, 0, ROAD_HALF, ROAD, w);
    if ((x + ROAD_END) % 0.6 < 0.3) add(x, 0, 0, ROAD, w * 0.6);
  }

  return {
    count: xs.length,
    x: Float32Array.from(xs),
    y: Float32Array.from(ys),
    z: Float32Array.from(zs),
    kind: Uint8Array.from(kinds),
    weight: Float32Array.from(weights),
  };
}

/** Where the story is at time t (seconds into the loop). */
function scene(t: number) {
  let coinX: number;
  if (t < 0.2) coinX = COIN_START;
  else if (t < 2.1) coinX = lerp(COIN_START, COIN_STOP, easeOutCubic((t - 0.2) / 1.9));
  else if (t < 2.9) coinX = COIN_STOP;
  else if (t < 4.6) coinX = lerp(COIN_STOP, COIN_END, easeInOutCubic((t - 2.9) / 1.7));
  else coinX = COIN_END;
  const coinAlpha = smoothstep(0, 0.5, t) * (1 - smoothstep(2.2, COIN_END, coinX));
  // Up for 0.6 s once the coin has paid, down for 0.6 s after it has gone through.
  const open = easeInOutCubic(clamp01((t - 2.45) / 0.6)) * (1 - easeInOutCubic(clamp01((t - 4.5) / 0.6)));
  const glow = smoothstep(2.1, 2.35, t) * (1 - smoothstep(4.5, 5.6, t));
  const ping = t >= 2.1 && t < 2.8 ? (t - 2.1) / 0.7 : -1;
  return { coinX, coinAlpha, open, glow, ping };
}

const isArm = (k: number) => k === ARM_EDGE || k === ARM_FACE;

/**
 * A toll gate drawn in 3D from dots: a coin rolls up, the barrier lifts, the coin rolls through.
 * Decorative; pass `label` to give screen readers a caption.
 */
export function Gate3D({ className = "", label }: { className?: string; label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    const darkQuery = matchMedia("(prefers-color-scheme: dark)");
    let reduced = motionQuery.matches;
    let dark = darkQuery.matches;

    const model = buildModel();
    const n = model.count;
    const sx = new Float32Array(n);
    const sy = new Float32Array(n);
    const bucketOf = new Uint8Array(n);
    const order = new Uint16Array(n);
    const counts = new Uint32Array(KINDS * LEVELS);
    const offsets = new Uint32Array(KINDS * LEVELS);

    let disposed = false;
    let ready = false;
    let visible = false;
    let raf = 0;
    let last = 0;
    let elapsed = 0;
    let dpr = 1;
    let w = 1;
    let h = 1;
    let scale = 1;
    let ox = 0;
    let oy = 0;
    let dotR = 1;
    let tiltX = 0;
    let tiltY = 0;
    let targetX = 0;
    let targetY = 0;
    let pointer: { x: number; y: number } | null = null;

    // Current view, refreshed each frame.
    let cyaw = 1;
    let syaw = 0;
    let cpitch = 1;
    let spitch = 0;
    // Output of project().
    let px = 0;
    let py = 0;
    let pz = 0;
    let pk = 1;

    function setView(yaw: number, pitch: number) {
      cyaw = Math.cos(yaw);
      syaw = Math.sin(yaw);
      cpitch = Math.cos(pitch);
      spitch = Math.sin(pitch);
    }

    function project(x: number, y: number, z: number) {
      const X = x - PIVOT[0];
      const Y = y - PIVOT[1];
      const Z = z - PIVOT[2];
      const x1 = X * cyaw - Z * syaw;
      const z1 = X * syaw + Z * cyaw;
      const y2 = Y * cpitch + z1 * spitch;
      pz = -Y * spitch + z1 * cpitch;
      pk = FOCAL / (FOCAL + pz);
      px = ox + x1 * pk * scale;
      py = oy - y2 * pk * scale;
    }

    // Rotate an arm point about the hinge (axis along x) by angle a, then project it.
    function projectArm(x: number, y: number, z: number, ca: number, sa: number) {
      const dy = y - HINGE[1];
      const dz = z - HINGE[2];
      project(x, HINGE[1] + dy * ca + dz * sa, HINGE[2] - dy * sa + dz * ca);
    }

    /** Size the canvas and fit the gate (at every yaw it will swing through) inside it. */
    function layout() {
      if (!canvas) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      canvas.width = w;
      canvas.height = h;

      const corners: number[][] = [];
      for (const b of [SLAB, PILLAR_HINGE, PILLAR_REST]) {
        for (let i = 0; i < 8; i++) corners.push([i & 1 ? b[3] : b[0], i & 2 ? b[4] : b[1], i & 4 ? b[5] : b[2], 0]);
      }
      for (let i = 0; i < 8; i++) corners.push([i & 1 ? ARM[3] : ARM[0], i & 2 ? ARM[4] : ARM[1], i & 4 ? ARM[5] : ARM[2], 1]);
      for (const x of [-2.4, 2.4]) for (const z of [-ROAD_HALF, ROAD_HALF]) corners.push([x, 0, z, 0]);

      scale = 1;
      ox = 0;
      oy = 0;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      const swing = YAW_AMP + TILT;
      for (let s = 0; s <= 6; s++) {
        for (const pitch of [PITCH - TILT, PITCH + TILT]) {
          setView(YAW_BASE - swing + (2 * swing * s) / 6, pitch);
          for (const angle of [0, ARM_OPEN]) {
            for (const c of corners) {
              if (c[3]) projectArm(c[0], c[1], c[2], Math.cos(angle), Math.sin(angle));
              else project(c[0], c[1], c[2]);
              minX = Math.min(minX, px);
              maxX = Math.max(maxX, px);
              minY = Math.min(minY, py);
              maxY = Math.max(maxY, py);
            }
          }
        }
      }
      scale = Math.min((w * 0.96) / (maxX - minX), (h * 0.94) / (maxY - minY));
      ox = w / 2 - (scale * (minX + maxX)) / 2;
      oy = h / 2 - (scale * (minY + maxY)) / 2;
      dotR = Math.min(1.25, Math.max(0.8, scale / dpr / 90)) * dpr;
      ready = true;
    }

    function fill(kind: number, level: number, glow: number) {
      const [rgb, far, near] = (dark ? DARK_RAMPS : LIGHT_RAMPS)[kind];
      const t = (level + 0.5) / LEVELS;
      let [r, g, b] = rgb;
      let a = far + (near - far) * t;
      if (kind === ARM_EDGE && glow > 0) {
        // The arm lights up a little while the payment clears.
        const to = dark ? EMERALD_300 : EMERALD_700;
        r = Math.round(lerp(r, to[0], glow));
        g = Math.round(lerp(g, to[1], glow));
        b = Math.round(lerp(b, to[2], glow));
        a = Math.min(1, a + 0.22 * glow);
      }
      return `rgba(${r},${g},${b},${a.toFixed(3)})`;
    }

    function draw(time: number, still: boolean) {
      if (!ctx || !ready) return;
      const yaw = still ? YAW_BASE : YAW_BASE + YAW_AMP * Math.sin((time * 2 * Math.PI) / YAW_PERIOD) + tiltX * TILT;
      const pitch = still ? PITCH : PITCH + tiltY * TILT;
      setView(yaw, pitch);
      const loopT = still ? STILL_T : time % LOOP;
      const s = scene(loopT);
      const angle = s.open * ARM_OPEN;
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);

      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);

      // A very soft contact shadow under the gate.
      project(0, 0, -0.15);
      const rx = 1.9 * scale * pk;
      const ry = rx * Math.max(0.2, spitch);
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(1, ry / rx);
      const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      const shade = dark ? "16,185,129" : "24,24,27";
      shadow.addColorStop(0, `rgba(${shade},${dark ? 0.05 : 0.06})`);
      shadow.addColorStop(1, `rgba(${shade},0)`);
      ctx.fillStyle = shadow;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Project every dot and bucket it by kind and depth.
      counts.fill(0);
      for (let i = 0; i < n; i++) {
        const k = model.kind[i];
        if (isArm(k)) projectArm(model.x[i], model.y[i], model.z[i], ca, sa);
        else project(model.x[i], model.y[i], model.z[i]);
        sx[i] = px;
        sy[i] = py;
        const t = clamp01(0.5 - pz / DEPTH_RANGE) * model.weight[i];
        const b = k * LEVELS + Math.min(LEVELS - 1, Math.floor(t * LEVELS));
        bucketOf[i] = b;
        counts[b]++;
      }
      let acc = 0;
      for (let b = 0; b < counts.length; b++) {
        offsets[b] = acc;
        acc += counts[b];
      }
      for (let i = 0; i < n; i++) order[offsets[bucketOf[i]]++] = i;

      // Dark mode adds light where dots overlap; light mode just layers ink.
      ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
      let start = 0;
      for (let b = 0; b < counts.length; b++) {
        const c = counts[b];
        if (!c) continue;
        const kind = Math.floor(b / LEVELS);
        const level = b % LEVELS;
        const lt = (level + 0.5) / LEVELS;
        const r = dotR * (0.6 + 0.55 * lt) * (kind === FACE || kind === ARM_FACE ? 0.85 : 1);
        ctx.fillStyle = fill(kind, level, s.glow);
        ctx.beginPath();
        for (let j = start; j < start + c; j++) {
          const i = order[j];
          ctx.moveTo(sx[i] + r, sy[i]);
          ctx.arc(sx[i], sy[i], r, 0, Math.PI * 2);
        }
        ctx.fill();
        start += c;
      }
      ctx.globalCompositeOperation = "source-over";

      drawCoin(s, loopT, still);
    }

    function drawCoin(s: ReturnType<typeof scene>, loopT: number, still: boolean) {
      if (!ctx || s.coinAlpha <= 0.01) return;
      const a = s.coinAlpha;
      const [r, g, b] = dark ? EMERALD_400 : EMERALD_600;
      const ink = (alpha: number) => `rgba(${r},${g},${b},${(alpha * a).toFixed(3)})`;

      // A short fading trail while it moves.
      if (!still) {
        const speed = Math.abs(s.coinX - scene(Math.max(0, loopT - 1 / 30)).coinX) * 30;
        const spread = Math.min(1, speed / 2.5) * 0.13;
        if (spread > 0.01) {
          for (let k = 1; k <= 6; k++) {
            project(s.coinX - k * spread, COIN_Y, COIN_Z);
            ctx.fillStyle = ink(0.32 * (1 - k / 7));
            ctx.beginPath();
            ctx.arc(px, py, dotR * pk * (1.1 - k * 0.08), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      project(s.coinX, COIN_Y, COIN_Z);
      const cx = px;
      const cy = py;
      const ck = pk;

      // Small, faint halo: enough to read as "lit", not a bloom.
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12 * dpr * ck);
      halo.addColorStop(0, ink(dark ? 0.2 : 0.14));
      halo.addColorStop(1, ink(0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, 12 * dpr * ck, 0, Math.PI * 2);
      ctx.fill();

      // The coin: a ring of dots that rolls along the road, and a bright centre.
      const roll = -(s.coinX - COIN_START) / COIN_R;
      ctx.fillStyle = ink(0.85);
      ctx.beginPath();
      for (let k = 0; k < 14; k++) {
        const t = roll + (k / 14) * Math.PI * 2;
        project(s.coinX + COIN_R * Math.cos(t), COIN_Y + COIN_R * Math.sin(t), COIN_Z);
        const rr = dotR * pk * 0.95;
        ctx.moveTo(px + rr, py);
        ctx.arc(px, py, rr, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.fillStyle = ink(1);
      ctx.beginPath();
      ctx.arc(cx, cy, dotR * ck * 1.7, 0, Math.PI * 2);
      ctx.fill();

      // One quiet ring as the payment lands.
      if (!still && s.ping >= 0) {
        const p = easeOutCubic(s.ping);
        ctx.strokeStyle = ink(0.35 * (1 - s.ping));
        ctx.lineWidth = dpr;
        ctx.beginPath();
        ctx.arc(cx, cy, (6 + 20 * p) * dpr * ck, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    function frame(now: number) {
      raf = 0;
      if (disposed || reduced || !visible || document.hidden) return;
      // Clamp the step so a stall (or a paused tab) never jumps the story forward.
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      elapsed += dt;

      if (pointer && canvas) {
        const rect = canvas.getBoundingClientRect();
        targetX = Math.max(-1, Math.min(1, (pointer.x - (rect.left + rect.width / 2)) / (window.innerWidth / 2)));
        targetY = Math.max(-1, Math.min(1, (pointer.y - (rect.top + rect.height / 2)) / (window.innerHeight / 2)));
      } else {
        targetX = 0;
        targetY = 0;
      }
      const k = 1 - Math.exp(-dt * 3);
      tiltX += (targetX - tiltX) * k;
      tiltY += (targetY - tiltY) * k;

      draw(elapsed, false);
      raf = requestAnimationFrame(frame);
    }

    function play() {
      if (!ready) return;
      if (reduced) {
        cancelAnimationFrame(raf);
        raf = 0;
        draw(0, true);
        return;
      }
      if (!raf && visible && !document.hidden) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    }

    function pause() {
      cancelAnimationFrame(raf);
      raf = 0;
    }

    function onPointer(e: PointerEvent) {
      if (e.pointerType === "touch") return;
      pointer = { x: e.clientX, y: e.clientY };
    }

    function onPointerOut(e: PointerEvent) {
      if (!e.relatedTarget) pointer = null;
    }

    function onVisibility() {
      if (document.hidden) pause();
      else play();
    }

    function onScheme(e: MediaQueryListEvent) {
      dark = e.matches;
      if (reduced || !raf) draw(reduced ? 0 : elapsed, reduced);
    }

    function onMotion(e: MediaQueryListEvent) {
      reduced = e.matches;
      play();
    }

    const resize = new ResizeObserver(() => {
      if (disposed) return;
      layout();
      // Resizing clears the canvas, so repaint straight away.
      draw(reduced ? 0 : elapsed, reduced);
    });
    resize.observe(canvas);

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) play();
      else pause();
    });
    io.observe(canvas);

    darkQuery.addEventListener("change", onScheme);
    motionQuery.addEventListener("change", onMotion);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerout", onPointerOut, { passive: true });

    return () => {
      disposed = true;
      pause();
      resize.disconnect();
      io.disconnect();
      darkQuery.removeEventListener("change", onScheme);
      motionQuery.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerout", onPointerOut);
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <canvas ref={canvasRef} aria-hidden className="block h-[200px] w-full sm:h-[280px]" />
      {label ? <p className="sr-only">{label}</p> : null}
    </div>
  );
}
