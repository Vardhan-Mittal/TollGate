import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { markDealPaid } from "@/lib/deals";
import { valueToCents } from "@/lib/paypal/orders";
import { verifyWebhook } from "@/lib/paypal/webhooks";
import { applyBatchStatus } from "@/lib/payouts";
import { creditCapture } from "@/lib/wallet";

type WebhookEvent = {
  id: string;
  event_type: string;
  resource: Record<string, unknown>;
};

export async function POST(req: NextRequest) {
  const event = (await req.json().catch(() => null)) as WebhookEvent | null;
  if (!event?.id || !event.event_type) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  if (!(await verifyWebhook(req.headers, event))) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  // PayPal retries deliveries; process each event id once.
  try {
    await prisma.webhookEvent.create({ data: { id: event.id, eventType: event.event_type } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    throw err;
  }

  try {
    await handle(event);
  } catch (err) {
    // Let PayPal retry: forget the event so the retry is processed.
    await prisma.webhookEvent.delete({ where: { id: event.id } }).catch(() => {});
    throw err;
  }
  return NextResponse.json({ ok: true });
}

async function handle(event: WebhookEvent) {
  const r = event.resource;

  switch (event.event_type) {
    case "PAYMENT.CAPTURE.COMPLETED": {
      const topUpId = r.custom_id as string | undefined;
      const amount = r.amount as { value: string } | undefined;
      if (!topUpId || !amount) return;
      const topUp = await prisma.topUp.findUnique({ where: { id: topUpId } });
      if (!topUp) return; // not a Tollgate wallet top-up
      const orderId = (r.supplementary_data as { related_ids?: { order_id?: string } } | undefined)?.related_ids?.order_id;
      await creditCapture({ topUpId, captureId: r.id as string, amountCents: valueToCents(amount.value), orderId });
      return;
    }

    case "INVOICING.INVOICE.PAID": {
      const deal = await prisma.deal.findUnique({ where: { paypalInvoiceId: r.id as string } });
      if (deal) await markDealPaid(deal.id);
      return;
    }

    case "PAYMENT.PAYOUTSBATCH.SUCCESS":
    case "PAYMENT.PAYOUTSBATCH.DENIED":
    case "PAYMENT.PAYOUTSBATCH.PROCESSING": {
      const header = r.batch_header as { payout_batch_id: string; batch_status: string; sender_batch_header?: { sender_batch_id?: string } };
      const payout = await prisma.payout.findUnique({ where: { paypalBatchId: header.payout_batch_id } });
      if (payout) await applyBatchStatus(payout.id, { batch_header: header });
      return;
    }

    case "PAYMENT.PAYOUTS-ITEM.SUCCEEDED":
    case "PAYMENT.PAYOUTS-ITEM.FAILED":
    case "PAYMENT.PAYOUTS-ITEM.RETURNED":
    case "PAYMENT.PAYOUTS-ITEM.BLOCKED":
    case "PAYMENT.PAYOUTS-ITEM.UNCLAIMED": {
      const batchId = r.payout_batch_id as string;
      const payout = await prisma.payout.findUnique({ where: { paypalBatchId: batchId } });
      if (payout) {
        await applyBatchStatus(payout.id, {
          batch_header: { payout_batch_id: batchId, batch_status: "SUCCESS" },
          items: [{ transaction_status: r.transaction_status as string, errors: r.errors as { message?: string } }],
        });
      }
      return;
    }
  }
}
