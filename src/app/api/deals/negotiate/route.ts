import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { runNegotiation, type NegotiationEvent } from "@/lib/ai/negotiation";
import { prisma } from "@/lib/db";
import { restoreDemoAgent } from "@/lib/demo-agent";
import { errorResponse } from "@/lib/http";
import { acquireLock, rateLimit, releaseLock } from "@/lib/rate-limit";
import { publicErrorMessage } from "@/lib/safe-error";
import { findAgentByKey } from "@/lib/tollgate/service";

const Body = z.object({ budgetCents: z.number().int().min(50).max(2000) });
// Plain errors from the negotiation that are written for the visitor and safe to show.
const USER_FACING = /^(No paid articles|The buyer agent has no saved PayPal|Invoice recipient is not allowed)/;

// Streams a buyer-agent vs publisher-agent negotiation as NDJSON events.
export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "negotiate", 4, 10 * 60_000);
  if (limited) return limited;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request", message: "Budget must be $0.50–$20.00." }, { status: 400 });
  const agentKey = process.env.DEMO_AGENT_KEY;
  if (!agentKey) return NextResponse.json({ error: "not_configured", message: "DEMO_AGENT_KEY is not set." }, { status: 500 });

  let agent: Awaited<ReturnType<typeof findAgentByKey>>;
  try {
    agent = await findAgentByKey(agentKey);
    await restoreDemoAgent(agent);
  } catch (err) {
    console.error("negotiation setup failed", err);
    try {
      return errorResponse(err);
    } catch {
      return NextResponse.json({ error: "negotiation_failed", message: "Could not start the negotiation." }, { status: 500 });
    }
  }

  // One run at a time across all servers keeps the public demo (and the AI quota) from being flooded.
  if (!(await acquireLock("negotiation", 5 * 60_000))) {
    return NextResponse.json({ error: "busy", message: "A negotiation is already running. Try again shortly." }, { status: 429 });
  }

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
        console.error("negotiation failed", err);
        const message =
          err instanceof Error && USER_FACING.test(err.message)
            ? err.message
            : publicErrorMessage(err, "Negotiation failed. Try again in a moment.");
        if (dealId) {
          await prisma.deal
            .updateMany({ where: { id: dealId, status: "NEGOTIATING" }, data: { status: "FAILED", failureReason: message.slice(0, 500) } })
            .catch(() => {});
        }
        emit({ type: "error", message });
      } finally {
        await releaseLock("negotiation");
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
