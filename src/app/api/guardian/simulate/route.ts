import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { prepareSimulationAgent } from "@/lib/guardian-simulation";
import { internalOrigin } from "@/lib/origin";
import { DEMO_PUBLISHER_ID } from "@/lib/publisher";
import { acquireLock, rateLimit, releaseLock } from "@/lib/rate-limit";
import { publicErrorMessage } from "@/lib/safe-error";
import { TollgateClient } from "@/lib/tollgate/client";

export type SimulationEvent =
  | { type: "start"; agentId: string; agent: string; article: string }
  | { type: "attempt"; n: number; outcome: "paid" | "held" | "frozen" | "error"; priceCents: number; detail: string }
  | { type: "held"; agentId: string; eventId: string | null; score: number; signals: string[] }
  | { type: "done"; message: string };

const MAX_ATTEMPTS = 12;

// The cheapest paid article right now, bought again and again like an agent
// stuck in a loop. Picked per run because visitors can change prices.
async function cheapestPaidArticle() {
  return prisma.resource.findFirst({
    where: { publisherId: DEMO_PUBLISHER_ID, priceReadCents: { gt: 0 } },
    orderBy: [{ priceReadCents: "asc" }, { path: "asc" }],
    select: { path: true },
  });
}

// Simulates a runaway agent against the real payment API so the Spend
// Guardian can be seen catching it. It pays from its own test wallet, so the
// freeze never blocks the demo agent the other demos use.
export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "guardian-sim", 3, 10 * 60_000);
  if (limited) return limited;
  if (!(await acquireLock("guardian-sim", 2 * 60_000))) {
    return NextResponse.json({ error: "busy", message: "A simulation is already running." }, { status: 429 });
  }
  let agent: Awaited<ReturnType<typeof prepareSimulationAgent>>;
  let loopPath: string;
  let origin: string;
  try {
    const article = await cheapestPaidArticle();
    if (!article) {
      await releaseLock("guardian-sim");
      return NextResponse.json(
        { error: "no_paid_article", message: "Every article is free right now, so there is nothing to loop on. Set a read price on the dashboard and try again." },
        { status: 409 },
      );
    }
    loopPath = article.path;
    origin = internalOrigin();
    agent = await prepareSimulationAgent();
  } catch (err) {
    console.error("simulation setup failed", err);
    await releaseLock("guardian-sim");
    return NextResponse.json({ error: "simulation_failed", message: "Could not start the simulation. Try again in a moment." }, { status: 500 });
  }
  const agentKey = agent.key;

  const client = new TollgateClient({ origin, agentKey, userAgent: "RunawayAgent/0.1 (stuck in a loop)" });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: SimulationEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        emit({ type: "start", agentId: agent.agentId, agent: agent.name, article: loopPath });
        for (let n = 1; n <= MAX_ATTEMPTS; n++) {
          const page = await client.open(loopPath);
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
            emit({ type: "held", agentId: agent.agentId, eventId: body.risk_event_id ?? null, score: body.risk_score ?? 1, signals: body.signals ?? [] });
            break;
          }
          emit({ type: "attempt", n, outcome: "error", priceCents, detail: payment.message });
          break;
        }
        emit({ type: "done", message: "Simulation finished." });
      } catch (err) {
        console.error("simulation failed", err);
        emit({ type: "done", message: publicErrorMessage(err, "Simulation failed.") });
      } finally {
        await releaseLock("guardian-sim");
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
