import "server-only";
import { PayPalMCPToolkit } from "@paypal/agent-toolkit/mcp";
import { generateText, stepCountIs, tool, type ModelMessage, type ToolSet } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { accessToken } from "@/lib/paypal/client";
import { requestPayout } from "@/lib/payouts";
import { accounts } from "@/lib/tollgate/service";
import { AGENT_MODELS, withModelFallback } from "./models";

export type CopilotAction = { tool: string; detail: string };

// Tools that send money or messages run only after an explicit human "yes".
const CONFIRM_PATTERN = /\b(yes|yep|confirm(ed)?|go ahead|do it|send it|proceed|approved?)\b/i;
const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const SYSTEM = `You are the finance assistant for a publisher that sells access to its articles to AI agents through Tollgate.
Earnings arrive in the publisher's Tollgate balance; cash-outs go to PayPal via PayPal Payouts.
Large AI customers can also be billed with PayPal invoices.

Rules:
- Use tools for every number. Never invent figures.
- Before cash_out or send_invoice, state exactly what will happen (amount, recipient) and ask the user to reply "yes".
  If a tool says confirmation is needed, ask for it; do not retry until the user says yes.
- Invoices: create a draft with create_invoice first (currency USD; one line item per article or a single
  "AI agent content access" line), then offer to send it.
- Keep answers short and concrete. Format money as $0.00.`;

async function paypalToolkitTools(publisherConfirmed: boolean, log: (a: CopilotAction) => void): Promise<ToolSet> {
  const toolkit = new PayPalMCPToolkit({
    accessToken: await accessToken(),
    configuration: {
      actions: { invoices: { create: true, list: true, get: true, send: true } },
      context: { sandbox: true },
    },
  });
  const api = toolkit.getPaypalAPIService();

  return Object.fromEntries(
    toolkit.getTools().map((def) => [
      def.method,
      tool({
        description: def.description,
        // The toolkit ships Zod 3 schemas; AI SDK accepts them as Standard Schema.
        inputSchema: def.parameters as unknown as z.ZodType<Record<string, unknown>>,
        execute: async (args: Record<string, unknown>) => {
          if (def.method === "send_invoice" && !publisherConfirmed) {
            return { status: "needs_confirmation", message: "Ask the user to confirm sending this invoice." };
          }
          log({ tool: `PayPal Agent Toolkit · ${def.method}`, detail: JSON.stringify(args).slice(0, 160) });
          const result = await api.run(def.method, args);
          return result.length > 4000 ? `${result.slice(0, 4000)}…` : result;
        },
      }),
    ]),
  );
}

function tollgateTools(publisherId: string, confirmed: boolean, log: (a: CopilotAction) => void): ToolSet {
  return {
    get_earnings_summary: tool({
      description: "Tollgate earnings: balance available to cash out, earnings by period, top articles and top AI agents.",
      inputSchema: z.object({}),
      execute: async () => {
        log({ tool: "Tollgate · get_earnings_summary", detail: "" });
        const account = accounts.publisher(publisherId);
        const since = (days: number) => new Date(Date.now() - days * 86_400_000);
        const sum = async (days?: number) =>
          (
            await prisma.ledgerEntry.aggregate({
              _sum: { amountCents: true },
              where: { account, kind: "EARNING", ...(days ? { createdAt: { gte: since(days) } } : {}) },
            })
          )._sum.amountCents ?? 0;

        const [publisher, today, week, allTime, grants, visits] = await Promise.all([
          prisma.publisher.findUniqueOrThrow({ where: { id: publisherId } }),
          sum(1),
          sum(7),
          sum(),
          prisma.accessGrant.findMany({ where: { resource: { publisherId } }, include: { resource: true, agent: true } }),
          prisma.botVisit.groupBy({ by: ["botName"], _count: true, orderBy: { _count: { botName: "desc" } }, take: 5 }),
        ]);

        const byArticle = new Map<string, { reads: number; grossCents: number }>();
        for (const g of grants) {
          const row = byArticle.get(g.resource.title) ?? { reads: 0, grossCents: 0 };
          row.reads += 1;
          row.grossCents += g.priceCents;
          byArticle.set(g.resource.title, row);
        }

        return {
          available_to_cash_out: usd(publisher.balanceCents),
          payout_email_on_file: publisher.paypalEmail,
          earned_after_fees: { last_24h: usd(today), last_7_days: usd(week), all_time: usd(allTime) },
          platform_fee: "10% of each agent payment",
          paid_reads: grants.length,
          top_articles: [...byArticle.entries()]
            .sort((a, b) => b[1].grossCents - a[1].grossCents)
            .slice(0, 5)
            .map(([title, v]) => ({ title, paid_reads: v.reads, gross: usd(v.grossCents) })),
          paying_agents: [...new Set(grants.map((g) => g.agent.name))],
          most_active_bots: visits.map((v) => ({ bot: v.botName ?? "unknown", visits: v._count })),
        };
      },
    }),

    list_payouts: tool({
      description: "Recent PayPal payouts of Tollgate earnings and their status.",
      inputSchema: z.object({}),
      execute: async () => {
        const payouts = await prisma.payout.findMany({ where: { publisherId }, orderBy: { createdAt: "desc" }, take: 10 });
        return payouts.map((p) => ({
          amount: usd(p.amountCents),
          to: p.receiverEmail,
          status: p.status.toLowerCase(),
          paypal_status: p.paypalStatus,
          date: p.createdAt.toISOString().slice(0, 10),
        }));
      },
    }),

    cash_out: tool({
      description: "Send the publisher's whole available balance to a PayPal account using PayPal Payouts.",
      inputSchema: z.object({ email: z.string().describe("PayPal email to receive the money") }),
      execute: async ({ email }) => {
        if (!confirmed) return { status: "needs_confirmation", message: "Ask the user to confirm the cash-out amount and email." };
        log({ tool: "PayPal Payouts · cash_out", detail: email });
        try {
          const payout = await requestPayout(publisherId, email);
          return { status: "sent", amount: usd(payout.amountCents), paypal_batch_id: payout.paypalBatchId, paypal_status: payout.paypalStatus };
        } catch (err) {
          return { status: "failed", message: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}

export async function runFinanceCopilot(opts: { publisherId: string; messages: ModelMessage[] }) {
  const lastUser = [...opts.messages].reverse().find((m) => m.role === "user");
  const confirmed = typeof lastUser?.content === "string" && CONFIRM_PATTERN.test(lastUser.content);

  const actions: CopilotAction[] = [];
  const log = (a: CopilotAction) => actions.push(a);
  const tools = { ...(await paypalToolkitTools(confirmed, log)), ...tollgateTools(opts.publisherId, confirmed, log) };

  const text = await withModelFallback(AGENT_MODELS, async (model) => {
    const result = await generateText({
      model,
      system: SYSTEM,
      messages: opts.messages,
      tools,
      stopWhen: stepCountIs(8),
      temperature: 0.2,
      maxRetries: 1,
    });
    return result.text;
  });

  return { text: text.trim(), actions };
}
