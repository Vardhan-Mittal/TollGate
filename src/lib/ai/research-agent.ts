import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { TollgateClient } from "@/lib/tollgate/client";
import { reissueAccess } from "@/lib/tollgate/service";
import { AGENT_MODELS, withModelFallback } from "./models";

export type AgentEvent =
  | { type: "start"; task: string; budgetCents: number }
  | { type: "model"; modelId: string }
  | { type: "thought"; text: string }
  | { type: "catalog"; count: number }
  | { type: "open"; path: string }
  | { type: "quote"; path: string; title: string; priceCents: number; teaser: string; quoteId: string }
  | { type: "free"; path: string; title: string }
  | { type: "owned"; path: string; title: string; priceCents: number; minutesAgo: number }
  | { type: "paid"; path: string; title: string; priceCents: number; reason: string; balance: string }
  | { type: "skipped"; path: string; title: string; priceCents: number; reason: string }
  | { type: "refused"; path: string; title: string; priceCents: number; reason: string }
  | { type: "answer"; text: string; sources: Source[]; spentCents: number; budgetCents: number }
  | { type: "error"; message: string };

type Source = { path: string; title: string; priceCents: number; paid: boolean; licensed?: boolean };
// token is the signed Tollgate quote; the model only ever sees a short handle like "q1".
type Quote = { path: string; title: string; priceCents: number; decided: boolean; token: string };

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function systemPrompt(budgetCents: number) {
  return `You are a research agent that buys access to articles on the open web through Tollgate.
Your total budget for this task is ${usd(budgetCents)}. You must never exceed it.

How to work:
1. Call list_sources to see what the publisher has.
2. Call open_source only for sources that look relevant to the task. Ignore clearly irrelevant ones.
3. When a source asks for payment, you get its price and a short teaser. For EVERY quote you must call
   either pay_for_source or skip_source, with a one-sentence reason a human can audit.
   Pay when the teaser suggests information the task genuinely needs (original data and fresh facts are
   worth more). Skip generic, redundant or off-topic material, and anything that would leave too little
   budget for more important sources.
4. When you have read enough, write the final answer: a short, well-organised response (under 250 words)
   that uses ONLY facts from sources you actually read. If you skipped something potentially useful,
   say so in one line at the end.

Citations (the reader's screen colours each sentence by the source it came from):
- Every sentence or bullet that uses a source must END with that source's title in square brackets,
  copied exactly as list_sources gives it, e.g. "Cell prices fell 20% this year [Exact Article Title]."
- If a sentence uses two sources, end it with both: "... [First Title] [Second Title]."
- Never shorten, paraphrase or translate a title, and never put anything else in square brackets.
- Sentences that use no source (an intro or the skipped-sources line) get no brackets.`;
}

export async function runResearchAgent(opts: {
  task: string;
  budgetCents: number;
  origin: string;
  agentKey: string;
  emit: (event: AgentEvent) => void;
}) {
  const { task, budgetCents, emit } = opts;
  const client = new TollgateClient({ origin: opts.origin, agentKey: opts.agentKey, userAgent: "TollgateResearchAgent/1.0" });

  // Run state lives outside the model call, so a model fallback mid-run never
  // pays twice for a page it already read.
  const quotes = new Map<string, Quote>();
  const library = new Map<string, { title: string; body: string }>();
  const sources: Source[] = [];
  let spentCents = 0;

  const tools = {
    list_sources: tool({
      description: "List the articles this publisher offers (titles, descriptions, dates). Free.",
      inputSchema: z.object({}),
      execute: async () => {
        const catalog = await client.catalog();
        emit({ type: "catalog", count: catalog.items.length });
        return catalog.items.map(({ path, title, description, published_at }) => ({
          path,
          title,
          description,
          published: published_at.slice(0, 10),
        }));
      },
    }),

    open_source: tool({
      description: "Open an article by path. Returns the content if free or already bought, otherwise a payment quote.",
      inputSchema: z.object({ path: z.string().describe("Path from list_sources, e.g. /blog/some-article") }),
      execute: async ({ path }) => {
        if (!path.startsWith("/blog/")) return { status: "error", message: "Only /blog/ paths are available." };
        const cached = library.get(path);
        if (cached) return { status: "already_read", title: cached.title, content: cached.body };

        emit({ type: "open", path });
        const result = await client.open(path);
        if (result.kind === "content") {
          library.set(path, { title: result.title, body: result.body });
          sources.push({ path, title: result.title, priceCents: 0, paid: false });
          emit({ type: "free", path, title: result.title });
          return { status: "free", title: result.title, content: result.body };
        }
        if (result.kind === "quote") {
          const q = result.quote;
          const priceCents = Math.round(Number(q.price.value) * 100);

          // Bought this licence a few minutes ago (e.g. in an earlier run)? Read it again, don't pay twice.
          // A failed lookup only means the agent buys as usual.
          const owned = await reissueAccess({ agentKey: opts.agentKey, path, license: "read" }).catch((err) => {
            console.error("licence lookup failed", err);
            return null;
          });
          if (owned) {
            const page = await client.read(path, owned.accessToken);
            if (page.kind === "content") {
              library.set(path, { title: page.title, body: page.body });
              sources.push({ path, title: page.title, priceCents: 0, paid: false, licensed: true });
              const minutesAgo = Math.max(0, Math.round((Date.now() - owned.boughtAt.getTime()) / 60_000));
              emit({ type: "owned", path, title: page.title, priceCents: owned.priceCents, minutesAgo });
              return { status: "already_licensed", title: page.title, content: page.body };
            }
          }

          const handle = `q${quotes.size + 1}`;
          quotes.set(handle, { path, title: q.title, priceCents, decided: false, token: q.quote_id });
          emit({ type: "quote", path, title: q.title, priceCents, teaser: q.teaser, quoteId: handle });
          return {
            status: "payment_required",
            quote_id: handle,
            title: q.title,
            price: usd(priceCents),
            teaser: q.teaser,
            remaining_budget: usd(budgetCents - spentCents),
          };
        }
        return { status: "error", message: result.message };
      },
    }),

    pay_for_source: tool({
      description: "Pay a quote and read the article. Use only when the content is worth its price for this task.",
      inputSchema: z.object({
        quote_id: z.string(),
        reason: z.string().describe("One sentence: why this is worth paying for"),
      }),
      execute: async ({ quote_id, reason }) => {
        const quote = quotes.get(quote_id);
        if (!quote) return { status: "error", message: "Unknown quote_id. Open the source first." };
        if (quote.decided) return { status: "error", message: "You already decided on this quote." };
        quote.decided = true;

        // Budget guardrail enforced in code, not left to the model. The model can
        // call this tool several times in parallel, so the money is reserved
        // before the first await and handed back only if the payment fails.
        if (spentCents + quote.priceCents > budgetCents) {
          const why = `Would exceed the ${usd(budgetCents)} budget (${usd(spentCents)} already spent).`;
          emit({ type: "refused", path: quote.path, title: quote.title, priceCents: quote.priceCents, reason: why });
          return { status: "refused", message: why };
        }
        spentCents += quote.priceCents;

        // A thrown error leaves the reservation in place: the charge may have gone through.
        const payment = await client.pay(quote.token);
        if (!payment.ok) {
          spentCents -= quote.priceCents;
          quote.decided = false;
          emit({ type: "error", message: `Payment failed: ${payment.message}` });
          return { status: "error", message: payment.message };
        }

        const page = await client.read(quote.path, payment.receipt.access_token);
        if (page.kind !== "content") return { status: "error", message: "Paid, but the content could not be read." };

        library.set(quote.path, { title: page.title, body: page.body });
        sources.push({ path: quote.path, title: page.title, priceCents: quote.priceCents, paid: true });
        emit({
          type: "paid",
          path: quote.path,
          title: quote.title,
          priceCents: quote.priceCents,
          reason,
          balance: payment.receipt.balance.value,
        });
        return { status: "paid", title: page.title, content: page.body, remaining_budget: usd(budgetCents - spentCents) };
      },
    }),

    skip_source: tool({
      description: "Decline a quote without paying.",
      inputSchema: z.object({
        quote_id: z.string(),
        reason: z.string().describe("One sentence: why this is not worth paying for"),
      }),
      execute: async ({ quote_id, reason }) => {
        const quote = quotes.get(quote_id);
        if (!quote) return { status: "error", message: "Unknown quote_id." };
        if (!quote.decided) {
          quote.decided = true;
          emit({ type: "skipped", path: quote.path, title: quote.title, priceCents: quote.priceCents, reason });
        }
        return { status: "skipped" };
      },
    }),
  };

  emit({ type: "start", task, budgetCents });

  const text = await withModelFallback(AGENT_MODELS, async (model, modelId) => {
    emit({ type: "model", modelId });
    const result = await generateText({
      model,
      system: systemPrompt(budgetCents),
      prompt: task,
      tools,
      stopWhen: stepCountIs(16),
      temperature: 0.3,
      maxRetries: 1,
      onStepFinish: (step) => {
        const thought = step.text.trim();
        if (thought && step.toolCalls.length > 0) emit({ type: "thought", text: thought });
      },
    });
    return result.text;
  });

  emit({ type: "answer", text: text.trim(), sources, spentCents, budgetCents });
}
