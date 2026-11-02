// Content and noise helpers for <PaywallLab />. Pure functions only, so the server and the
// first client render produce identical (seeded) noise and hydration never mismatches.

/** Glyphs used for noise: plain ASCII, so every one is exactly one `ch` wide. */
export const GLYPHS = "abcdefghijklmnopqrstuvwxyz0123456789{}[]()<>/\\|=+-*_:;.,~^%$#@!?";

/** Line height of both panels, in px. Pointer maths and the slit use it directly. */
export const LH = 18;

/** Small, fast, deterministic PRNG (mulberry32). */
export function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randomGlyph = (r: number) => Math.floor(r * GLYPHS.length);

/* ---------- [ REQUEST ]: the 402 → pay → 200 exchange ---------- */

// Header names and JSON fields match src/lib/tollgate/protocol.ts and the gate/pay routes;
// the values are illustrative.
export const REQUEST_LINES = [
  `$ curl -i -A GPTBot -H "Tollgate-License: read" \\`,
  `  tollgate.example/blog/q3-2026-battery-cell-price-survey`,
  `HTTP/1.1 402 Payment Required`,
  `Tollgate-Price: 0.24 USD`,
  `Tollgate-Quote: eyJhbGciOiJIUzI1NiJ9.eyJyZXMiOi…`,
  `{ "quote_id": "eyJhbGciOi…", "license": "read",`,
  `  "teaser": "Prices from 40 suppliers, one table…",`,
  `  "pay_url": "https://tollgate.example/api/tollgate/pay" }`,
  `$ curl -X POST https://tollgate.example/api/tollgate/pay \\`,
  `    -H "Authorization: Bearer tg_agent_…" \\`,
  `    -d '{"quote_id":"eyJhbGciOi…"}'`,
  `HTTP/1.1 200 OK`,
  `{ "access_token": "…", "expires_in": 600,`,
  `  "charged": { "value": "0.24", "currency": "USD" } }`,
] as const;

export const REQUEST_STEPS = [
  { from: 0, to: 1, name: "Request", note: "GET · GPTBot asks for the article and names the license it wants" },
  { from: 2, to: 4, name: "402 Payment Required", note: "402 · the price an AI set for this article, signed so it can't be edited" },
  { from: 5, to: 7, name: "Quote", note: "quote · a teaser to judge it by, and where to pay before it expires" },
  { from: 8, to: 10, name: "Pay", note: "pay · the agent's key spends from a wallet funded through PayPal" },
  { from: 11, to: 13, name: "200 OK", note: "200 · a 10-minute token to read the article; 0.24 USD charged" },
] as const;

export type RequestNoise = { thr: Float32Array[]; gly: Uint8Array[] };

/** Per character: a fixed threshold (when it starts to scramble) and its current glyph. */
export function requestNoise(): RequestNoise {
  const rand = seeded(402);
  const thr: Float32Array[] = [];
  const gly: Uint8Array[] = [];
  for (const line of REQUEST_LINES) {
    const t = new Float32Array(line.length);
    const g = new Uint8Array(line.length);
    for (let i = 0; i < line.length; i++) {
      t[i] = rand();
      g[i] = randomGlyph(rand());
    }
    thr.push(t);
    gly.push(g);
  }
  return { thr, gly };
}

/** Distance in lines from line `i`'s centre to the slit band [top, top + h]; 0 inside. */
export function slitDistance(i: number, top: number, h: number) {
  const c = i + 0.5;
  return Math.max(0, top - c, c - (top + h));
}

/** One request line as seen at distance `d` from the slit: crisp inside, scrambled outside. */
export function scrambleLine(i: number, d: number, noise: RequestNoise) {
  const src = REQUEST_LINES[i];
  if (d <= 0) return src;
  const density = Math.min(0.9, 0.08 + 0.26 * d);
  const thr = noise.thr[i];
  const gly = noise.gly[i];
  let out = "";
  for (let k = 0; k < src.length; k++) {
    const ch = src[k];
    out += ch !== " " && thr[k] < density ? GLYPHS[gly[k]] : ch;
  }
  return out;
}

export const lineOpacity = (d: number) => (d <= 0 ? 1 : Math.max(0.3, 0.78 - 0.08 * d));

/* ---------- [ ARTICLE ]: the gated text ---------- */

// Adapted from the fictional Q3 battery survey in prisma/seed.ts.
export const ARTICLE_TITLE = "Q3 2026 Battery Cell Price Survey";
export const ARTICLE_TEASER =
  "Prices from 40 suppliers, one table: per-kWh cell quotes across LFP and NMC, with quarter-on-quarter changes and lead times.";
export const ARTICLE_BODY =
  "Every quarter we ask the same 40 cell suppliers for a firm quote on a 100 MWh order. This is the first edition where the median LFP quote fell below $50 per kWh. Median LFP cell: $48.70 per kWh, down 6.1% from Q2. Median NMC 811 cell: $71.20 per kWh, down 2.4%. Lead times rose from 9 to 11 weeks as grid-storage buyers ordered early. Seven of 40 suppliers quoted LFP below $45, and the spread between the cheapest and dearest quote narrowed to $14 per kWh, the tightest since the survey began.";

export const ARTICLE_ROWS = 15;
export const DEFAULT_COLS = 60;

export type ArticleGrid = {
  cols: number;
  /** Real text, one string per row, each padded to `cols`. */
  rows: string[];
  /** 1 where the cell belongs to the teaser (the only text a non-paying bot gets). */
  teaser: Uint8Array;
  /** Non-space characters in the visible article. */
  total: number;
  /** Vertical centre of the teaser, in rows. */
  teaserMid: number;
};

function wrap(text: string, cols: number) {
  const out: string[] = [];
  let line = "";
  for (let word of text.split(" ")) {
    while (word.length > cols) {
      if (line) out.push(line);
      out.push(word.slice(0, cols));
      word = word.slice(cols);
      line = "";
    }
    if (!line) line = word;
    else if (line.length + 1 + word.length <= cols) line += " " + word;
    else {
      out.push(line);
      line = word;
    }
  }
  if (line) out.push(line);
  return out;
}

/** Word-wraps the article into a fixed `ARTICLE_ROWS` × `cols` grid (truncated with "…"). */
export function wrapArticle(cols: number): ArticleGrid {
  const lines: { text: string; teaser: boolean }[] = [];
  const paras = [
    { text: ARTICLE_TITLE, teaser: false },
    { text: ARTICLE_TEASER, teaser: true },
    { text: ARTICLE_BODY, teaser: false },
  ];
  paras.forEach((p, i) => {
    if (i > 0) lines.push({ text: "", teaser: false });
    for (const text of wrap(p.text, cols)) lines.push({ text, teaser: p.teaser });
  });
  if (lines.length > ARTICLE_ROWS) {
    lines.length = ARTICLE_ROWS;
    const last = lines[ARTICLE_ROWS - 1];
    last.text = (last.text.length >= cols ? last.text.slice(0, cols - 1) : last.text) + "…";
  }
  while (lines.length < ARTICLE_ROWS) lines.push({ text: "", teaser: false });

  const teaser = new Uint8Array(ARTICLE_ROWS * cols);
  let total = 0;
  let first = -1;
  let last = -1;
  const rows = lines.map((l, r) => {
    if (l.teaser) {
      teaser.fill(1, r * cols, r * cols + l.text.length);
      if (first < 0) first = r;
      last = r;
    }
    for (const ch of l.text) if (ch !== " ") total++;
    return l.text.padEnd(cols, " ");
  });
  return { cols, rows, teaser, total, teaserMid: (first + last + 1) / 2 };
}

export type ArticleNoise = { gly: Uint8Array; jit: Float32Array };

export function articleNoise(cols: number): ArticleNoise {
  const rand = seeded(24 + cols);
  const n = ARTICLE_ROWS * cols;
  const gly = new Uint8Array(n);
  const jit = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    gly[i] = randomGlyph(rand());
    jit[i] = rand();
  }
  return { gly, jit };
}

/** The full field of noise, as row strings (the server-rendered first frame). */
export function noiseRows(noise: ArticleNoise, cols: number) {
  const rows: string[] = [];
  for (let r = 0; r < ARTICLE_ROWS; r++) {
    let s = "";
    for (let c = 0; c < cols; c++) s += GLYPHS[noise.gly[r * cols + c]];
    rows.push(s);
  }
  return rows;
}
