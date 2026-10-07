import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { TollgateClient } from "@/lib/tollgate/client";
import { AGENT_MODELS, withModelFallback } from "./models";

export type AgentEvent =
  | { type: "start"; task: string; budgetCents: number }
  | { type: "model"; modelId: string }
  | { type: "thought"; text: string }
  | { type: "catalog"; count: number }
  | { type: "open"; path: string }
  | { type: "quote"; path: string; title: string; priceCents: number; teaser: string; quoteId: string }
  | { type: "free"; path: string; title: string }
  | { type: "paid"; path: string; title: string; priceCents: number; reason: string; balance: string }
  | { type: "skipped"; path: string; title: string; priceCents: number; reason: string }
  | { type: "refused"; path: string; title: string; priceCents: number; reason: string }
  | { type: "answer"; text: string; sources: Source[]; spentCents: number; budgetCents: number }
  | { type: "error"; message: string };

type Source = { path: string; title: string; priceCents: number; paid: boolean };
type Quote = { path: string; title: string; priceCents: number; decided: boolean };

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
   that uses ONLY facts from sources you actually read. Cite them inline like [Title]. If you skipped
   something potentially useful, say so in one line at the end.`;
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
          quotes.set(q.quote_id, { path, title: q.title, priceCents, decided: false });
          emit({ type: "quote", path, title: q.title, priceCents, teaser: q.teaser, quoteId: q.quote_id });
          return {
            status: "payment_required",
            quote_id: q.quote_id,
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

        // Budget guardrail enforced in code, not left to the model.
        if (spentCents + quote.priceCents > budgetCents) {
          quote.decided = true;
          const why = `Would exceed the ${usd(budgetCents)} budget (${usd(spentCents)} already spent).`;
          emit({ type: "refused", path: quote.path, title: quote.title, priceCents: quote.priceCents, reason: why });
          return { status: "refused", message: why };
        }

        const payment = await client.pay(quote_id);
        if (!payment.ok) {
          emit({ type: "error", message: `Payment failed: ${payment.message}` });
          return { status: "error", message: payment.message };
        }
        quote.decided = true;
        spentCents += quote.priceCents;

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
