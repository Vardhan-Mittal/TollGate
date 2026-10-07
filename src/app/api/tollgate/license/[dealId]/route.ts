import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { readBearerKey } from "@/lib/tollgate/keys";
import { findAgentByKey } from "@/lib/tollgate/service";

// Delivers the licensed training dataset to the agent that paid for the deal.
export async function GET(req: NextRequest, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const key = readBearerKey(req.headers);
  if (!key) return NextResponse.json({ error: "missing_agent_key", message: "Send Authorization: Bearer <agent API key>." }, { status: 401 });

  try {
    const agent = await findAgentByKey(key);
    const deal = await prisma.deal.findUnique({ where: { id: dealId }, include: { publisher: true } });
    if (!deal || deal.agentId !== agent.id) return NextResponse.json({ error: "not_found", message: "No such license." }, { status: 404 });
    if (deal.status !== "PAID") {
      return NextResponse.json({ error: "payment_required", message: "Pay the PayPal invoice to activate this license.", invoice_url: deal.invoiceUrl }, { status: 402 });
    }

    const articles = await prisma.resource.findMany({ where: { id: { in: deal.resourceIds } } });
    return NextResponse.json({
      license: "train",
      licensor: deal.publisher.name,
      licensee: agent.name,
      deal_id: deal.id,
      paid: { amount: ((deal.agreedPriceCents ?? 0) / 100).toFixed(2), currency: "USD", paypal_invoice: deal.paypalInvoiceId, at: deal.paidAt },
      articles: articles.map((a) => ({ path: a.path, title: a.title, published_at: a.publishedAt, body: a.body })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
