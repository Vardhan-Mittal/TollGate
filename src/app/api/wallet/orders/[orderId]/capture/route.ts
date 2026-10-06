import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/http";
import { finishTopUp } from "@/lib/wallet";

// Called after the buyer approves in the PayPal popup. Captures the payment
// and credits the agent wallet (idempotent; the webhook may also credit it).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  try {
    return NextResponse.json(await finishTopUp(orderId));
  } catch (err) {
    return errorResponse(err);
  }
}
