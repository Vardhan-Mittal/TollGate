"use client";

import { useEffect, useMemo, useState, type PointerEvent, type ReactNode } from "react";
import type { AgentEvent } from "@/lib/ai/research-agent";

type Answer = Extract<AgentEvent, { type: "answer" }>;
type Source = Answer["sources"][number];

// Muted tints that keep text ≥ 4.5:1 in both themes (800 on 100, 300 on a 15% tint over near-black).
const PALETTE = [
  {
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300",
    dot: "bg-emerald-500",
    line: "decoration-emerald-500/40",
    glow: "bg-emerald-50 dark:bg-emerald-400/10",
  },
  {
    chip: "bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300",
    dot: "bg-sky-500",
    line: "decoration-sky-500/40",
    glow: "bg-sky-50 dark:bg-sky-400/10",
  },
  {
    chip: "bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-300",
    dot: "bg-violet-500",
    line: "decoration-violet-500/40",
    glow: "bg-violet-50 dark:bg-violet-400/10",
  },
  {
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
    dot: "bg-amber-500",
    line: "decoration-amber-500/40",
    glow: "bg-amber-50 dark:bg-amber-400/10",
  },
  {
    chip: "bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-300",
    dot: "bg-rose-500",
    line: "decoration-rose-500/40",
    glow: "bg-rose-50 dark:bg-rose-400/10",
  },
];
const NEUTRAL_CHIP = "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";

const cents = (c: number) => (c < 100 ? `${c}¢` : `$${(c / 100).toFixed(2)}`);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const TOKEN = /(\*\*[^*]+\*\*|\[[^\]]+\])/g;
// A sentence ends at . ! ? (optionally followed by quotes, bold or a closing citation) or after a citation.
const SENTENCE_BREAK = /(?<=[.!?][*"')\]]*|\])\s+(?=[A-Z0-9*"'(\[])/;

// Chips show a short form of the title (full title stays in the accessible name and tooltip).
function shortTitle(title: string) {
  const head = title.split(/:\s| [—–-] /)[0].trim();
  if (head.length <= 36) return head;
  const cut = head.slice(0, 34);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 16 ? cut.lastIndexOf(" ") : 34)}…`;
}

// Exact title first, then a forgiving match for slightly trimmed titles.
function findSource(label: string, sources: Source[]) {
  const n = norm(label);
  if (!n) return undefined;
  return (
    sources.find((s) => norm(s.title) === n) ??
    (n.length >= 8 ? sources.find((s) => norm(s.title).startsWith(n) || n.startsWith(norm(s.title))) : undefined)
  );
}

// "[A; B]" is read as two citations unless the whole label is itself a title.
function citedPaths(label: string, sources: Source[]) {
  const whole = findSource(label, sources);
  if (whole) return [whole.path];
  return label.split(/\s*;\s*/).flatMap((part) => findSource(part, sources)?.path ?? []);
}

type Sentence = { text: string; paths: string[] };
type Line = { bullet: boolean; sentences: Sentence[] };

function parse(text: string, sources: Source[]): Line[] {
  return text
    .split("\n")
    .filter((l) => l.trim())
    .map((raw) => {
      const bullet = /^\s*[-*] /.test(raw);
      const body = bullet ? raw.replace(/^\s*[-*] /, "") : raw.replace(/^#+\s*/, "");
      const sentences: Sentence[] = [];
      for (const piece of body.split(SENTENCE_BREAK)) {
        // A citation stranded at the start of a sentence ("... fell. [Title] Next") belongs to the one before.
        const lead = piece.match(/^(\s*\[[^\]]+\])+/)?.[0];
        const prev = sentences.at(-1);
        if (lead && prev) {
          prev.text += ` ${lead.trim()}`;
          const rest = piece.slice(lead.length).trim();
          if (rest) sentences.push({ text: rest, paths: [] });
        } else {
          sentences.push({ text: piece, paths: [] });
        }
      }
      for (const s of sentences) {
        const labels = [...s.text.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
        s.paths = [...new Set(labels.flatMap((l) => citedPaths(l, sources)))];
      }
      return { bullet, sentences };
    });
}

/**
 * The agent's answer with source provenance: each cited source gets a colour, its chips and sentences
 * carry it, and picking a source in the legend (or a chip) dims every sentence that didn't come from it.
 */
export function AnswerCard({ answer }: { answer: Answer }) {
  const lines = useMemo(() => parse(answer.text, answer.sources), [answer.text, answer.sources]);

  // Colours go to sources in order of first citation, so the first highlight is always emerald.
  const colourOf = useMemo(() => {
    const order = [...new Set(lines.flatMap((l) => l.sentences.flatMap((s) => s.paths)))];
    return new Map(order.map((path, i) => [path, PALETTE[i % PALETTE.length]]));
  }, [lines]);
  const citeCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of lines.flatMap((l) => l.sentences)) for (const p of s.paths) counts.set(p, (counts.get(p) ?? 0) + 1);
    return counts;
  }, [lines]);

  const [pinned, setPinned] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const focus = hovered ?? pinned;

  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPinned(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pinned]);

  const toggle = (path: string) => setPinned((p) => (p === path ? null : path));
  // Hover previews only for a real mouse; a tap goes straight to toggle.
  const hoverProps = (path: string) => ({
    onPointerEnter: (e: PointerEvent) => e.pointerType === "mouse" && setHovered(path),
    onPointerLeave: () => setHovered(null),
  });

  const inline = (text: string): ReactNode[] =>
    text.split(TOKEN).map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("[") && part.endsWith("]")) {
        const label = part.slice(1, -1);
        const path = citedPaths(label, answer.sources)[0];
        const colour = path ? colourOf.get(path) : undefined;
        const title = answer.sources.find((s) => s.path === path)?.title ?? label;
        if (!path || !colour) {
          return <span key={i} className={`mx-0.5 rounded px-1.5 py-0.5 text-xs ${NEUTRAL_CHIP}`}>{label}</span>;
        }
        return (
          <button
            key={i}
            type="button"
            aria-pressed={pinned === path}
            aria-label={`Source: ${title}`}
            title={title}
            onClick={() => toggle(path)}
            {...hoverProps(path)}
            className={`mx-0.5 rounded px-1.5 py-0.5 align-baseline text-xs leading-5 outline-offset-2 ${colour.chip} ${
              pinned === path ? "ring-1 ring-current" : ""
            }`}
          >
            {shortTitle(title)}
          </button>
        );
      }
      return part;
    });

  const sentence = (s: Sentence, key: number) => {
    const colour = s.paths[0] ? colourOf.get(s.paths[0]) : undefined;
    const lit = focus !== null && s.paths.includes(focus);
    const dim = focus !== null && !lit;
    return (
      <span
        key={key}
        className={`rounded-sm box-decoration-clone transition-[opacity,background-color] duration-150 ease-out motion-reduce:transition-none ${
          colour ? `underline decoration-2 underline-offset-4 ${colour.line}` : ""
        } ${lit && colour ? colour.glow : ""} ${dim ? "opacity-35" : ""}`}
      >
        {inline(s.text)}{" "}
      </span>
    );
  };

  const paidCount = answer.sources.filter((s) => s.paid).length;

  return (
    <section aria-labelledby="answer-heading" className="rounded-xl border-2 border-emerald-500/40 p-5">
      <h2 id="answer-heading" className="font-semibold">Answer</h2>
      <div className="mt-3 space-y-2 text-[15px] leading-7 break-words">
        {lines.map((line, i) =>
          line.bullet ? (
            <p key={i} className="pl-4 -indent-4">
              <span aria-hidden>• </span>
              {line.sentences.map(sentence)}
            </p>
          ) : (
            <p key={i}>{line.sentences.map(sentence)}</p>
          ),
        )}
      </div>

      <div className="mt-4 border-t border-zinc-200 pt-3 text-sm dark:border-zinc-800">
        <p className="text-zinc-500">
          Paid {cents(answer.spentCents)} of a {cents(answer.budgetCents)} budget to {paidCount} publisher article
          {paidCount === 1 ? "" : "s"}, settled through the agent&apos;s PayPal-funded wallet.
        </p>
        {answer.sources.length > 0 && (
          <>
            <ul aria-label="Sources" className="mt-2 flex flex-wrap gap-1.5">
              {answer.sources.map((s) => {
                const colour = colourOf.get(s.path);
                const count = citeCount.get(s.path) ?? 0;
                const status = s.paid ? `Paid ${cents(s.priceCents)}` : s.licensed ? "Licensed" : "Free";
                const active = focus === s.path;
                return (
                  <li key={s.path} className="flex min-w-0 max-w-full items-center">
                    <button
                      type="button"
                      aria-pressed={pinned === s.path}
                      aria-label={`${s.title}, ${status}, ${count ? `cited in ${count} sentence${count === 1 ? "" : "s"}` : "not cited"}`}
                      onClick={() => toggle(s.path)}
                      {...hoverProps(s.path)}
                      className={`flex min-w-0 max-w-full items-center gap-2 rounded-l-lg border py-1 pr-2 pl-2.5 text-left transition-[opacity,border-color,background-color] duration-150 ease-out motion-reduce:transition-none ${
                        active
                          ? "border-zinc-400 bg-zinc-50 dark:border-zinc-500 dark:bg-zinc-900"
                          : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                      } ${focus !== null && !active ? "opacity-50" : ""}`}
                    >
                      <span
                        aria-hidden
                        className={`size-2 shrink-0 rounded-full ${colour ? colour.dot : "border border-zinc-400 dark:border-zinc-600"}`}
                      />
                      <span className="truncate">{s.title}</span>
                      <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                        {status}
                        {!count && " · not cited"}
                      </span>
                    </button>
                    <a
                      href={s.path}
                      aria-label={`Open ${s.title}`}
                      className={`-ml-px shrink-0 rounded-r-lg border px-2 py-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 ${
                        active ? "border-zinc-400 dark:border-zinc-500" : "border-zinc-200 dark:border-zinc-800"
                      }`}
                    >
                      <span aria-hidden>↗</span>
                    </a>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-zinc-500">
              {pinned ? "Showing one source. Select it again or press Escape to see all." : "Select a source to see which sentences it supports."}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
