"use client";

import { useEffect, useRef } from "react";

const VERTEX = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAGMENT = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uBase;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uStrength;
uniform float uGrain;

// 2D simplex noise by Ian McEwan, Ashima Arts / Stefan Gustavson (MIT).
// https://github.com/ashima/webgl-noise
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

// A soft ribbon of light whose centre line wanders with the noise.
float ribbon(vec2 uv, float aspect, float t, float seed, float y, float width) {
  float x = uv.x * aspect;
  float centre = y + 0.16 * snoise(vec2(x * 0.7 + t + seed, t * 0.6 + seed));
  float w = width * (0.75 + 0.35 * snoise(vec2(x * 1.3 - t, seed)));
  float body = exp(-pow((uv.y - centre) / w, 2.0));
  // Fine vertical rays give it the curtain look.
  float rays = 0.65 + 0.35 * snoise(vec2(x * 9.0 + seed, t * 1.8));
  return body * rays;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  float t = uTime * 0.05;

  float a = ribbon(uv, aspect, t, 0.0, 0.58, 0.16);
  float b = ribbon(uv, aspect, t * 1.3, 7.3, 0.42, 0.12);
  // A broad, slow haze underneath ties the two together.
  float haze = 0.5 + 0.5 * snoise(vec2(uv.x * aspect * 0.5 - t * 0.5, uv.y * 0.8 + t * 0.3));

  // Fade every streak out toward the edges so it melts into the page.
  float edge = smoothstep(0.0, 0.3, uv.x) * smoothstep(1.0, 0.7, uv.x) * smoothstep(0.0, 0.35, uv.y) * smoothstep(1.0, 0.65, uv.y);

  vec3 col = uBase;
  col = mix(col, uColorB, clamp(haze * 0.25 * edge * uStrength, 0.0, 1.0));
  col = mix(col, uColorA, clamp(a * edge * uStrength, 0.0, 1.0));
  col = mix(col, uColorB, clamp(b * 0.85 * edge * uStrength, 0.0, 1.0));
  col += (hash(gl_FragCoord.xy + fract(uTime * 0.37) * 113.0) - 0.5) * uGrain;
  gl_FragColor = vec4(col, 1.0);
}
`;

type Palette = { base: number[]; a: number[]; b: number[]; strength: number; grain: number };

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

// Dark: bright emerald and teal on near-black. Light: pale mint washes on white.
const DARK: Palette = { base: hex("#0a0a0a"), a: hex("#10b981"), b: hex("#14b8a6"), strength: 0.55, grain: 0.05 };
const LIGHT: Palette = { base: hex("#ffffff"), a: hex("#6ee7b7"), b: hex("#99f6e4"), strength: 0.45, grain: 0.035 };

/** Slow emerald aurora drawn by a fragment shader, with a CSS gradient behind it as the fallback. */
export function Aurora({ className = "", grain = true }: { className?: string; grain?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl", { antialias: false, alpha: true, premultipliedAlpha: false });
    if (!canvas || !gl) return; // the CSS gradient underneath stays visible

    function compile(type: number, src: string) {
      const shader = gl!.createShader(type)!;
      gl!.shaderSource(shader, src);
      gl!.compileShader(shader);
      return shader;
    }

    const vs = compile(gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return;
    }
    gl.useProgram(program);

    // One triangle that covers the whole viewport.
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = (name: string) => gl.getUniformLocation(program, name);
    const uRes = u("uRes");
    const uTime = u("uTime");

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const darkQuery = matchMedia("(prefers-color-scheme: dark)");

    function applyPalette(dark: boolean) {
      const p = dark ? DARK : LIGHT;
      gl!.uniform3fv(u("uBase"), p.base);
      gl!.uniform3fv(u("uColorA"), p.a);
      gl!.uniform3fv(u("uColorB"), p.b);
      gl!.uniform1f(u("uStrength"), p.strength);
      gl!.uniform1f(u("uGrain"), grain ? p.grain : 0);
    }
    applyPalette(darkQuery.matches);

    let raf = 0;
    let visible = false;
    const start = performance.now();
    // Start part-way in so the first frame already has shape.
    const timeAt = (now: number) => 40 + (now - start) / 1000;

    function draw(time: number) {
      gl!.uniform1f(uTime, time);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    }

    function frame(now: number) {
      raf = 0;
      if (!visible) return;
      draw(timeAt(now));
      raf = requestAnimationFrame(frame);
    }

    function play() {
      if (reduced) draw(40);
      else if (!raf && visible) raf = requestAnimationFrame(frame);
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas!.width = Math.max(1, Math.round(canvas!.clientWidth * dpr));
      canvas!.height = Math.max(1, Math.round(canvas!.clientHeight * dpr));
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
      gl!.uniform2f(uRes, canvas!.width, canvas!.height);
      // Resizing clears the canvas, so repaint straight away.
      draw(reduced ? 40 : timeAt(performance.now()));
    }

    function onScheme(e: MediaQueryListEvent) {
      applyPalette(e.matches);
      if (reduced || !visible) draw(reduced ? 40 : timeAt(performance.now()));
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) return play();
      cancelAnimationFrame(raf);
      raf = 0;
    });
    io.observe(canvas);
    darkQuery.addEventListener("change", onScheme);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      darkQuery.removeEventListener("change", onScheme);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [grain]);

  return (
    <div aria-hidden className={`pointer-events-none relative ${className}`}>
      {/* Fallback when WebGL is missing; the canvas paints over it when it works. */}
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_55%,rgb(16_185_129/0.14),transparent_70%)] dark:bg-[radial-gradient(60%_50%_at_50%_55%,rgb(16_185_129/0.22),transparent_70%)]" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
