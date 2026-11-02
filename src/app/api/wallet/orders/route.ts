import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { DEMO_MODE } from "@/lib/demo";
import { publicOrigin } from "@/lib/origin";
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
  const limited = await rateLimit(req, "topup", 10, 10 * 60_000);
  if (limited) return limited;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request", message: "Body must be { agentId, amountCents, save }." }, { status: 400 });
  }

  try {
    let { save } = parsed.data;
    if (DEMO_MODE && save) {
      // A saved PayPal (e.g. the shared demo wallet's) cannot be swapped for a visitor's own account.
      const agent = await prisma.agent.findUnique({ where: { id: parsed.data.agentId }, select: { paypalVaultId: true } });
      if (agent?.paypalVaultId) save = false;
    }
    const { orderId } = await startTopUp({ ...parsed.data, save, origin: publicOrigin(req) });
    return NextResponse.json({ orderId });
  } catch (err) {
    return errorResponse(err);
  }
}
