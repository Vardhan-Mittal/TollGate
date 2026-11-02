import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { restoreDemoAgent } from "@/lib/demo-agent";
import { internalOrigin } from "@/lib/origin";
import { acquireLock, rateLimit, releaseLock } from "@/lib/rate-limit";
import { publicErrorMessage } from "@/lib/safe-error";
import { runResearchAgent, type AgentEvent } from "@/lib/ai/research-agent";
import { findAgentByKey } from "@/lib/tollgate/service";

const Body = z.object({
  task: z.string().trim().min(5).max(500),
  budgetCents: z.number().int().min(5).max(200),
});


// Streams the research agent's steps as newline-delimited JSON events.
export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "agent", 6, 10 * 60_000);
  if (limited) return limited;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request", message: "Give a task (5–500 chars) and a budget of 5–200 cents." }, { status: 400 });
  }
  const agentKey = process.env.DEMO_AGENT_KEY;
  if (!agentKey) return NextResponse.json({ error: "not_configured", message: "DEMO_AGENT_KEY is not set." }, { status: 500 });
  // One run at a time across all servers keeps the public demo (and the AI quota) from being flooded.
  if (!(await acquireLock("agent-run", 5 * 60_000))) {
    return NextResponse.json({ error: "busy", message: "Another agent run is in progress. Try again in a moment." }, { status: 429 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: AgentEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        await restoreDemoAgent(await findAgentByKey(agentKey));
        await runResearchAgent({ ...parsed.data, origin: internalOrigin(), agentKey, emit });
      } catch (err) {
        console.error("agent run failed", err);
        emit({ type: "error", message: publicErrorMessage(err, "Agent run failed. Try again in a moment.") });
      } finally {
        await releaseLock("agent-run");
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
