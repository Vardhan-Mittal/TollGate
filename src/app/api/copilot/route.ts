import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { runFinanceCopilot } from "@/lib/ai/finance-copilot";
import { errorResponse } from "@/lib/http";
import { DEMO_PUBLISHER_ID } from "@/lib/publisher";

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .min(1)
    .max(20),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "copilot", 20, 10 * 60_000);
  if (limited) return limited;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request", message: "Send { messages }." }, { status: 400 });

  try {
    return NextResponse.json(await runFinanceCopilot({ publisherId: DEMO_PUBLISHER_ID, messages: parsed.data.messages }));
  } catch (err) {
    try {
      return errorResponse(err);
    } catch {
      console.error("copilot failed", err);
      return NextResponse.json({ error: "copilot_failed", message: "The assistant hit an error. Try again." }, { status: 500 });
    }
  }
}
