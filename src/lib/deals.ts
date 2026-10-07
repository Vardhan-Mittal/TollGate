import "server-only";
import { PayPalMCPToolkit } from "@paypal/agent-toolkit/mcp";
import { prisma } from "@/lib/db";
import { isAllowedInvoiceRecipient } from "@/lib/demo";
import { accessToken, paypalRequest } from "@/lib/paypal/client";
import { centsToValue } from "@/lib/paypal/orders";
import { PLATFORM_FEE_BPS } from "@/lib/tollgate/protocol";
import { accounts } from "@/lib/tollgate/service";

// The publisher's standing policy for bulk training licenses. The floor is
// private to the publisher's agent; the buyer never sees it.
export const DEAL_POLICY = {
  floorPct: 60, // never sell below 60% of list
  maxRounds: 4, // offers per side before walking away
};

/** Email on the buyer's saved PayPal account, used as the invoice recipient. */
export async function payerEmailForAgent(agentId: string) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (agent?.operatorEmail) return agent.operatorEmail;
  if (!agent?.paypalVaultId) return null;
  const token = await paypalRequest<{ payment_source?: { paypal?: { email_address?: string } } }>(
    `/v3/vault/payment-tokens/${encodeURIComponent(agent.paypalVaultId)}`,
  );
  return token.payment_source?.paypal?.email_address ?? null;
}

async function invoiceToolkit() {
  const toolkit = new PayPalMCPToolkit({
    accessToken: await accessToken(),
    configuration: { actions: { invoices: { create: true, send: true, get: true } }, context: { sandbox: true } },
  });
  return toolkit.getPaypalAPIService();
}

/**
 * Settles an agreed deal: the publisher's agent creates and sends a PayPal
 * invoice through the PayPal Agent Toolkit. Returns the buyer's pay link.
 */
export async function invoiceDeal(dealId: string) {
  const deal = await prisma.deal.findUniqueOrThrow({ where: { id: dealId }, include: { publisher: true } });
  if (!deal.agreedPriceCents || !deal.buyerEmail) throw new Error("Deal has no agreed price or buyer email.");
  if (!isAllowedInvoiceRecipient(deal.buyerEmail)) throw new Error("Invoice recipient is not allowed in the public demo.");

  const api = await invoiceToolkit();
  const created = JSON.parse(
    await api.run("create_invoice", {
      currency_code: "USD",
      reference: deal.id,
      invoicer_business_name: `${deal.publisher.name} (via Tollgate)`,
      note: `AI training license for ${deal.resourceIds.length} articles, negotiated by AI agents on Tollgate. Deal ${deal.id}.`,
      primary_recipients: [{ billing_info: { email_address: deal.buyerEmail } }],
      items: [
        {
          name: `AI training license · ${deal.resourceIds.length} articles · ${deal.publisher.name}`,
          quantity: "1",
          unit_amount: { currency_code: "USD", value: centsToValue(deal.agreedPriceCents) },
        },
      ],
    }),
  );
  const invoiceId: string | undefined = created.id ?? created.href?.split("/").pop();
  if (!invoiceId) throw new Error(`PayPal did not return an invoice id: ${JSON.stringify(created).slice(0, 200)}`);

  await api.run("send_invoice", { invoice_id: invoiceId, send_to_recipient: true, note: "Thank you for licensing our work." });
  const invoice = JSON.parse(await api.run("get_invoice", { invoice_id: invoiceId }));
  const url: string | undefined = invoice.detail?.metadata?.recipient_view_url;

  await prisma.deal.update({
    where: { id: deal.id },
    data: { status: "INVOICED", paypalInvoiceId: invoiceId, invoiceUrl: url ?? null },
  });
  return { invoiceId, url: url ?? null };
}

/** Marks a deal paid and credits the publisher (net of the platform fee). Idempotent. */
export async function markDealPaid(dealId: string) {
  return prisma.$transaction(async (tx) => {
    const flipped = await tx.deal.updateMany({
      where: { id: dealId, status: "INVOICED" },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (flipped.count === 0) return false;

    const deal = await tx.deal.findUniqueOrThrow({ where: { id: dealId } });
    const gross = deal.agreedPriceCents ?? 0;
    const fee = Math.floor((gross * PLATFORM_FEE_BPS) / 10_000);
    await tx.publisher.update({ where: { id: deal.publisherId }, data: { balanceCents: { increment: gross - fee } } });
    await tx.ledgerEntry.createMany({
      data: [
        { account: accounts.publisher(deal.publisherId), kind: "LICENSE_SALE", amountCents: gross - fee, externalRef: deal.paypalInvoiceId, idempotencyKey: `deal:${deal.id}` },
        { account: accounts.platform, kind: "FEE", amountCents: fee, externalRef: deal.paypalInvoiceId, idempotencyKey: `deal-fee:${deal.id}` },
      ],
    });
    return true;
  });
}

/** Asks PayPal whether an invoiced deal has been paid yet. */
export async function refreshDeal(dealId: string) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal?.paypalInvoiceId || deal.status !== "INVOICED") return deal;
  const invoice = await paypalRequest<{ status: string }>(`/v2/invoicing/invoices/${deal.paypalInvoiceId}`);
  if (invoice.status === "PAID" || invoice.status === "MARKED_AS_PAID") await markDealPaid(deal.id);
  return prisma.deal.findUnique({ where: { id: dealId } });
}
