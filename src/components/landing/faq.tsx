"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Reveal } from "@/components/motion";
import { ThinkingOrb } from "@/components/thinking-orb";
import { FAQ_ITEMS } from "@/lib/ai/faq-facts";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const MAX_CHARS = 200;
const ASK = "ask";

type AskState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; answer: string; source: "ai" | "faq" }
  | { status: "error"; message: string };

/** "Questions, answered.": a hairline accordion whose last row is a live question box answered by Gemini. */
export function Faq({ className = "" }: { className?: string }) {
  const uid = useId();
  const [open, setOpen] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [ask, setAsk] = useState<AskState>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const asking = ask.status !== "idle";
  // Loading or answered: the box shows the asked question until "Ask another". After an error it stays editable.
  const locked = ask.status === "loading" || ask.status === "done";

  const toggle = (id: string) => setOpen((cur) => (cur === id ? null : id));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || locked) return;
    setOpen(ASK);
    setAsk({ status: "loading" });

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || typeof data?.answer !== "string") {
        // Server messages are written for visitors; anything else gets a generic line.
        setAsk({ status: "error", message: typeof data?.message === "string" ? data.message : "Couldn't get an answer. Try again." });
        return;
      }
      setAsk({ status: "done", answer: data.answer, source: data.source === "ai" ? "ai" : "faq" });
    } catch {
      if (!ctrl.signal.aborted) setAsk({ status: "error", message: "Couldn't reach the assistant. Check your connection and try again." });
    }
  }

  function reset() {
    abortRef.current?.abort();
    setAsk({ status: "idle" });
    setQuestion("");
    setOpen(null);
    inputRef.current?.focus();
  }

  const askPanel = `${uid}-ask-panel`;

  return (
    <section aria-labelledby={`${uid}-heading`} className={`mt-24 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.75fr)] lg:gap-16 ${className}`}>
      <Reveal className="self-start lg:sticky lg:top-24">
        <h2 id={`${uid}-heading`} className="text-3xl font-bold tracking-tight sm:text-4xl">
          <span className="text-sheen">Questions,</span>{" "}
          <span className="font-serif text-[1.08em] font-normal italic text-emerald-600 dark:text-emerald-400">answered.</span>
        </h2>
        <p className="mt-3 max-w-sm text-zinc-600 dark:text-zinc-400">
          The short ones are here. Ask anything else and Gemini answers from Tollgate&apos;s own docs.
        </p>
      </Reveal>

      <Reveal delay={0.05}>
        <ul className="border-t border-zinc-200 dark:border-zinc-800">
          {FAQ_ITEMS.map((item) => {
            const isOpen = open === item.id;
            const buttonId = `${uid}-${item.id}-button`;
            const panelId = `${uid}-${item.id}-panel`;
            return (
              <li key={item.id} className="border-b border-zinc-200 dark:border-zinc-800">
                <h3>
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggle(item.id)}
                    className="group flex w-full items-center justify-between gap-6 rounded-sm py-5 text-left font-medium tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 sm:text-lg"
                  >
                    <span>{item.question}</span>
                    <Chevron open={isOpen} />
                  </button>
                </h3>
                <Panel id={panelId} labelledBy={buttonId} open={isOpen}>
                  <p className="max-w-prose pb-6 pr-10 text-zinc-600 dark:text-zinc-400">{item.answer}</p>
                </Panel>
              </li>
            );
          })}

          {/* The last row looks like one more question, but it is a text box. */}
          <li className="border-b border-zinc-200 dark:border-zinc-800">
            <form onSubmit={submit} className="flex items-center gap-4 py-3.5">
              <label htmlFor={`${uid}-ask`} className="sr-only">
                Ask anything else about Tollgate
              </label>
              <input
                ref={inputRef}
                id={`${uid}-ask`}
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onFocus={() => asking && setOpen(ASK)}
                readOnly={locked}
                maxLength={MAX_CHARS}
                autoComplete="off"
                enterKeyHint="send"
                aria-describedby={`${uid}-ask-count`}
                placeholder="Ask anything else about Tollgate…"
                className="min-w-0 flex-1 rounded-sm bg-transparent py-1.5 font-medium tracking-tight caret-emerald-500 placeholder:text-zinc-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-500 read-only:cursor-default sm:text-lg dark:placeholder:text-zinc-500"
              />
              <span
                id={`${uid}-ask-count`}
                className={`font-mono text-[11px] tabular-nums text-zinc-500 ${question.length > MAX_CHARS - 40 && !locked ? "" : "sr-only"}`}
              >
                {question.length}/{MAX_CHARS}
              </span>
              <button
                type="submit"
                aria-label="Ask"
                disabled={!question.trim() || locked}
                className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-white transition-[opacity,transform] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 active:scale-95 disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
              >
                <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                  <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </form>

            <Panel id={askPanel} label="Answer" open={open === ASK}>
              <div role="status" aria-live="polite" className="pb-6 pr-2 sm:pr-10">
                {ask.status === "loading" && (
                  <p className="flex h-6 items-center gap-2 text-sm text-zinc-500">
                    <ThinkingOrb size={16} />
                    Gemini is thinking…
                  </p>
                )}
                {ask.status === "done" && (
                  <>
                    <p className="max-w-prose break-words text-zinc-600 dark:text-zinc-400">{ask.answer}</p>
                    <Footer onReset={reset}>
                      {ask.source === "ai" ? "Answered by Gemini · grounded in Tollgate’s docs" : "Closest FAQ answer · Gemini unavailable"}
                    </Footer>
                  </>
                )}
                {ask.status === "error" && (
                  <>
                    <p className="max-w-prose text-zinc-600 dark:text-zinc-400">{ask.message}</p>
                    <Footer onReset={reset}>No answer</Footer>
                  </>
                )}
              </div>
            </Panel>
          </li>
        </ul>
      </Reveal>
    </section>
  );
}

/** Height-animated disclosure panel. Stays mounted so aria-controls always resolves; `inert` hides it while closed. */
function Panel({ id, labelledBy, label, open, children }: { id: string; labelledBy?: string; label?: string; open: boolean; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      id={id}
      role="region"
      aria-labelledby={labelledBy}
      aria-label={label}
      inert={!open}
      initial={false}
      animate={open ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
      transition={{
        height: { duration: reduce ? 0 : open ? 0.3 : 0.2, ease: EASE_OUT },
        opacity: { duration: open ? 0.25 : 0.12, ease: "easeOut" },
      }}
      className="overflow-hidden"
    >
      {children}
    </motion.div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={`size-4 shrink-0 transition-[transform,color] duration-200 ease-out motion-reduce:transition-none ${
        open ? "rotate-180 text-emerald-600 dark:text-emerald-400" : "text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200"
      }`}
    >
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Footer({ onReset, children }: { onReset: () => void; children: ReactNode }) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">{children}</p>
      <button
        type="button"
        onClick={onReset}
        className="rounded-sm text-sm font-medium text-emerald-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:text-emerald-400"
      >
        Ask another
      </button>
    </div>
  );
}

