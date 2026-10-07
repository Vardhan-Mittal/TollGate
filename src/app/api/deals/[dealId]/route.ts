import { NextResponse, type NextRequest } from "next/server";
import { refreshDeal } from "@/lib/deals";
import { errorResponse } from "@/lib/http";

// Deal status; checks PayPal for invoice payment so the page updates even
// without webhooks (e.g. local development).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  try {
    const deal = await refreshDeal(dealId);
    if (!deal) return NextResponse.json({ error: "not_found", message: "No such deal." }, { status: 404 });
    return NextResponse.json(
      {
        id: deal.id,
        status: deal.status,
        agreedPriceCents: deal.agreedPriceCents,
        invoiceId: deal.paypalInvoiceId,
        invoiceUrl: deal.invoiceUrl,
        paidAt: deal.paidAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
