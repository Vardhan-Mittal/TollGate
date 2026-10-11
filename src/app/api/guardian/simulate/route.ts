import { NextResponse, type NextRequest } from "next/server";
import { publicOrigin } from "@/lib/origin";
import { acquireLock, rateLimit, releaseLock } from "@/lib/rate-limit";
import { TollgateClient } from "@/lib/tollgate/client";
import { findAgentByKey } from "@/lib/tollgate/service";

export type SimulationEvent =
  | { type: "start"; agentId: string; agent: string; article: string }
  | { type: "attempt"; n: number; outcome: "paid" | "held" | "frozen" | "error"; priceCents: number; detail: string }
  | { type: "held"; agentId: string; eventId: string | null; score: number; signals: string[] }
  | { type: "done"; message: string };

// The cheapest gated article, bought again and again like an agent stuck in a loop.
const LOOP_PATH = "/blog/ten-tips-ev-battery-life";
const MAX_ATTEMPTS = 12;

// Simulates a runaway agent against the real payment API so the Spend
// Guardian can be seen catching it. Costs a few cents of sandbox balance.
export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "guardian-sim", 3, 10 * 60_000);
  if (limited) return limited;
  const agentKey = process.env.DEMO_AGENT_KEY;
  if (!agentKey) return NextResponse.json({ error: "not_configured", message: "DEMO_AGENT_KEY is not set." }, { status: 500 });
  const agent = await findAgentByKey(agentKey);
  if (!(await acquireLock("guardian-sim", 2 * 60_000))) {
    return NextResponse.json({ error: "busy", message: "A simulation is already running." }, { status: 429 });
  }

  const client = new TollgateClient({ origin: publicOrigin(req), agentKey, userAgent: "RunawayAgent/0.1 (stuck in a loop)" });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: SimulationEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        emit({ type: "start", agentId: agent.id, agent: agent.name, article: LOOP_PATH });
        for (let n = 1; n <= MAX_ATTEMPTS; n++) {
          const page = await client.open(LOOP_PATH);
          if (page.kind !== "quote") {
            emit({ type: "attempt", n, outcome: "error", priceCents: 0, detail: "Expected a 402 quote." });
            break;
          }
          const priceCents = Math.round(Number(page.quote.price.value) * 100);
          const payment = await client.pay(page.quote.quote_id);
          if (payment.ok) {
            emit({ type: "attempt", n, outcome: "paid", priceCents, detail: `Paid · wallet $${payment.receipt.balance.value}` });
            continue;
          }
          if (payment.error === "payment_held" || payment.error === "wallet_frozen") {
            const body = payment.details as { risk_event_id?: string; risk_score?: number; signals?: string[] };
            emit({ type: "attempt", n, outcome: payment.error === "payment_held" ? "held" : "frozen", priceCents, detail: payment.message });
            emit({ type: "held", agentId: agent.id, eventId: body.risk_event_id ?? null, score: body.risk_score ?? 1, signals: body.signals ?? [] });
            break;
          }
          emit({ type: "attempt", n, outcome: "error", priceCents, detail: payment.message });
          break;
        }
        emit({ type: "done", message: "Simulation finished." });
      } catch (err) {
        emit({ type: "done", message: err instanceof Error ? err.message : "Simulation failed." });
      } finally {
        await releaseLock("guardian-sim");
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
