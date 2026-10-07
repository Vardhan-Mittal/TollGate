import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/http";
import { startTopUp } from "@/lib/wallet";

const Body = z.object({
  agentId: z.string().min(1),
  amountCents: z.number().int(),
  save: z.boolean().default(false),
});

// Creates a PayPal order for a wallet top-up. The browser then opens the
// PayPal checkout with the returned order id.
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "topup", 10, 10 * 60_000);
  if (limited) return limited;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request", message: "Body must be { agentId, amountCents, save }." }, { status: 400 });
  }

  try {
    const { orderId } = await startTopUp({ ...parsed.data, origin: req.nextUrl.origin });
    return NextResponse.json({ orderId });
  } catch (err) {
    return errorResponse(err);
  }
}
