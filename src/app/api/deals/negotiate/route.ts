import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { runNegotiation, type NegotiationEvent } from "@/lib/ai/negotiation";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { findAgentByKey } from "@/lib/tollgate/service";

const Body = z.object({ budgetCents: z.number().int().min(50).max(2000) });

let running = false;

// Streams a buyer-agent vs publisher-agent negotiation as NDJSON events.
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "negotiate", 4, 10 * 60_000);
  if (limited) return limited;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request", message: "Budget must be $0.50–$20.00." }, { status: 400 });
  const agentKey = process.env.DEMO_AGENT_KEY;
  if (!agentKey) return NextResponse.json({ error: "not_configured", message: "DEMO_AGENT_KEY is not set." }, { status: 500 });
  if (running) return NextResponse.json({ error: "busy", message: "A negotiation is already running. Try again shortly." }, { status: 429 });

  running = true;
  const agent = await findAgentByKey(agentKey);
  const encoder = new TextEncoder();
  let dealId: string | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: NegotiationEvent) => {
        if (event.type === "setup") dealId = event.dealId;
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      try {
        await runNegotiation({ agentId: agent.id, budgetCents: parsed.data.budgetCents, emit });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Negotiation failed.";
        console.error("negotiation failed", err);
        if (dealId) {
          await prisma.deal
            .updateMany({ where: { id: dealId, status: "NEGOTIATING" }, data: { status: "FAILED", failureReason: message.slice(0, 500) } })
            .catch(() => {});
        }
        emit({ type: "error", message });
      } finally {
        running = false;
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
