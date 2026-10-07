import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { runResearchAgent, type AgentEvent } from "@/lib/ai/research-agent";

const Body = z.object({
  task: z.string().trim().min(5).max(500),
  budgetCents: z.number().int().min(5).max(200),
});

// One run at a time per server keeps the public demo from being flooded.
let running = false;

// Streams the research agent's steps as newline-delimited JSON events.
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "agent", 6, 10 * 60_000);
  if (limited) return limited;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request", message: "Give a task (5–500 chars) and a budget of 5–200 cents." }, { status: 400 });
  }
  const agentKey = process.env.DEMO_AGENT_KEY;
  if (!agentKey) return NextResponse.json({ error: "not_configured", message: "DEMO_AGENT_KEY is not set." }, { status: 500 });
  if (running) return NextResponse.json({ error: "busy", message: "Another agent run is in progress. Try again in a moment." }, { status: 429 });

  running = true;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: AgentEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        await runResearchAgent({ ...parsed.data, origin: req.nextUrl.origin, agentKey, emit });
      } catch (err) {
        console.error("agent run failed", err);
        emit({ type: "error", message: err instanceof Error ? err.message : "Agent run failed." });
      } finally {
        running = false;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
