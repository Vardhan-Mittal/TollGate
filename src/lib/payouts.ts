import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { DEMO_MODE, DEMO_PAYOUT_EMAIL } from "@/lib/demo";
import { PayPalError, paypalRequest } from "@/lib/paypal/client";
import { centsToValue } from "@/lib/paypal/orders";
import { TollgateError, accounts } from "@/lib/tollgate/service";

export const MIN_PAYOUT_CENTS = 100;

type PayoutBatch = {
  batch_header: { payout_batch_id: string; batch_status: string };
  items?: { transaction_status?: string; errors?: { name?: string; message?: string } }[];
};

// Item statuses that mean the money did not reach the publisher.
const FAILED_ITEM_STATUSES = new Set(["FAILED", "RETURNED", "BLOCKED", "REFUNDED", "REVERSED", "DENIED"]);

/**
 * True only when PayPal definitely refused the batch, so no money can have
 * moved. Network errors, timeouts, 5xx and unreadable responses are unknown
 * outcomes: the payout stays PENDING and refreshPayout settles it.
 */
function isDefiniteRejection(err: unknown) {
  return (
    err instanceof PayPalError &&
    err.status >= 400 &&
    err.status < 500 &&
    // 409: the same request id is still being processed. A reused batch id
    // means an earlier attempt already created the batch.
    err.status !== 409 &&
    err.name !== "SENDER_BATCH_ID_ALREADY_USED"
  );
}

/**
 * Moves a publisher's whole balance out through PayPal Payouts. The balance
 * is reserved first, so a double click cannot pay twice; if PayPal definitely
 * rejects the batch, the reservation is reversed.
 */
export async function requestPayout(publisherId: string, receiverEmail: string) {
  // The public demo always pays the configured sandbox publisher account, and
  // pays nobody if that account is not configured.
  if (DEMO_MODE && !DEMO_PAYOUT_EMAIL) {
    throw new TollgateError(503, "payouts_disabled", "Cash-outs are disabled in this demo until a sandbox payout account is configured.");
  }
  const target = DEMO_MODE && DEMO_PAYOUT_EMAIL ? DEMO_PAYOUT_EMAIL : receiverEmail;
  const email = z.email().safeParse(target.trim());
  if (!email.success) throw new TollgateError(400, "invalid_email", "Enter a valid PayPal email address.");

  const payout = await prisma.$transaction(async (tx) => {
    const publisher = await tx.publisher.findUniqueOrThrow({ where: { id: publisherId } });
    const amount = publisher.balanceCents;
    if (amount < MIN_PAYOUT_CENTS) {
      throw new TollgateError(400, "below_minimum", "You need at least $1.00 in earnings to cash out.");
    }

    const reserved = await tx.publisher.updateMany({
      where: { id: publisherId, balanceCents: amount },
      data: { balanceCents: { decrement: amount }, paypalEmail: email.data },
    });
    if (reserved.count === 0) throw new TollgateError(409, "balance_changed", "Balance changed, please try again.");

    const payout = await tx.payout.create({
      data: { publisherId, amountCents: amount, receiverEmail: email.data },
    });
    await tx.ledgerEntry.create({
      data: {
        account: accounts.publisher(publisherId),
        kind: "PAYOUT",
        amountCents: -amount,
        externalRef: payout.id,
        idempotencyKey: `payout:${payout.id}`,
      },
    });
    return payout;
  });

  return submitPayout(payout);
}

/**
 * Sends (or re-sends) the batch for a payout. The PayPal-Request-Id and
 * sender_batch_id are the payout id, so a retry never creates a second batch.
 */
async function submitPayout(payout: { id: string; receiverEmail: string; amountCents: number }) {
  let batch: PayoutBatch;
  try {
    batch = await paypalRequest<PayoutBatch>("/v1/payments/payouts", {
      method: "POST",
      requestId: `payout-${payout.id}`,
      body: {
        sender_batch_header: {
          sender_batch_id: payout.id,
          email_subject: "You have a payout from Tollgate",
          email_message: "AI agents paid to read your content. Here are your earnings.",
        },
        items: [
          {
            recipient_type: "EMAIL",
            receiver: payout.receiverEmail,
            amount: { value: centsToValue(payout.amountCents), currency: "USD" },
            note: "Tollgate earnings from AI agent reads",
            sender_item_id: payout.id,
          },
        ],
      },
    });
  } catch (err) {
    if (isDefiniteRejection(err)) {
      await failPayout(payout.id, err instanceof Error ? err.message : String(err));
      throw err;
    }
    // PayPal may have accepted it: keep the money reserved and the payout PENDING.
    console.error("payout outcome unknown; left pending", { payoutId: payout.id, err });
    return prisma.payout.update({
      where: { id: payout.id },
      data: { paypalStatus: "UNCONFIRMED" },
    });
  }
  return prisma.payout.update({
    where: { id: payout.id },
    data: { paypalBatchId: batch.batch_header.payout_batch_id, paypalStatus: batch.batch_header.batch_status },
  });
}

/** Marks a payout failed and returns the money to the publisher's balance (once). */
export async function failPayout(payoutId: string, reason: string) {
  await prisma.$transaction(async (tx) => {
    const flipped = await tx.payout.updateMany({
      where: { id: payoutId, status: "PENDING" },
      data: { status: "FAILED", failureReason: reason.slice(0, 500) },
    });
    if (flipped.count === 0) return;

    const payout = await tx.payout.findUniqueOrThrow({ where: { id: payoutId } });
    await tx.publisher.update({
      where: { id: payout.publisherId },
      data: { balanceCents: { increment: payout.amountCents } },
    });
    await tx.ledgerEntry.create({
      data: {
        account: accounts.publisher(payout.publisherId),
        kind: "PAYOUT_REVERSAL",
        amountCents: payout.amountCents,
        externalRef: payout.id,
        idempotencyKey: `payout-reversal:${payout.id}`,
      },
    });
  });
}

/** Pulls the latest batch status from PayPal and settles the payout if final. */
export async function refreshPayout(payoutId: string) {
  const payout = await prisma.payout.findUnique({ where: { id: payoutId } });
  if (!payout || payout.status !== "PENDING") return payout;
  // The first submit's outcome was unknown: re-send with the same request id,
  // which returns the original batch if PayPal already created it.
  if (!payout.paypalBatchId) return submitPayout(payout);

  const batch = await paypalRequest<PayoutBatch>(`/v1/payments/payouts/${payout.paypalBatchId}`);
  return applyBatchStatus(payout.id, batch);
}

export async function applyBatchStatus(payoutId: string, batch: PayoutBatch) {
  const batchStatus = batch.batch_header.batch_status;
  const item = batch.items?.[0];
  const itemStatus = item?.transaction_status;
  const shown = itemStatus ? `${batchStatus} / ${itemStatus}` : batchStatus;

  if (batchStatus === "DENIED" || batchStatus === "CANCELED" || (itemStatus && FAILED_ITEM_STATUSES.has(itemStatus))) {
    await failPayout(payoutId, item?.errors?.message ?? `PayPal status ${shown}`);
  } else if (itemStatus === "SUCCESS") {
    await prisma.payout.updateMany({ where: { id: payoutId, status: "PENDING" }, data: { status: "SUCCESS" } });
  }
  return prisma.payout.update({ where: { id: payoutId }, data: { paypalStatus: shown } });
}
