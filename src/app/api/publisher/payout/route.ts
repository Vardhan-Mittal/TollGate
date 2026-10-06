import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/http";
import { requestPayout } from "@/lib/payouts";
import { DEMO_PUBLISHER_ID } from "@/lib/publisher";

const Body = z.object({ email: z.string() });

// Cashes out the publisher's whole balance to a PayPal account via Payouts.
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request", message: "Body must be { email }." }, { status: 400 });

  try {
    const payout = await requestPayout(DEMO_PUBLISHER_ID, parsed.data.email);
    return NextResponse.json({
      payout_id: payout.id,
      amount: (payout.amountCents / 100).toFixed(2),
      paypal_batch_id: payout.paypalBatchId,
      paypal_status: payout.paypalStatus,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
