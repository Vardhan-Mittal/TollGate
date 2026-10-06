import "server-only";
import { prisma } from "@/lib/db";
import { PayPalError } from "@/lib/paypal/client";
import {
  captureOrder,
  chargeVaultedPayPal,
  createWalletOrder,
  firstCapture,
  valueToCents,
  type PayPalOrder,
} from "@/lib/paypal/orders";
import { TollgateError, accounts } from "@/lib/tollgate/service";

export const TOP_UP_MIN_CENTS = 100;
export const TOP_UP_MAX_CENTS = 10_000;

export async function startTopUp(opts: { agentId: string; amountCents: number; save: boolean; origin: string }) {
  if (!Number.isInteger(opts.amountCents) || opts.amountCents < TOP_UP_MIN_CENTS || opts.amountCents > TOP_UP_MAX_CENTS) {
    throw new TollgateError(400, "invalid_amount", "Top-ups must be between $1.00 and $100.00.");
  }
  const agent = await prisma.agent.findUnique({ where: { id: opts.agentId } });
  if (!agent) throw new TollgateError(404, "agent_not_found", "No such agent.");

  const topUp = await prisma.topUp.create({ data: { agentId: agent.id, amountCents: opts.amountCents } });
  const order = await createWalletOrder({
    topUpId: topUp.id,
    agentId: agent.id,
    amountCents: opts.amountCents,
    origin: opts.origin,
    saveForAutoRecharge: opts.save,
    customerId: agent.paypalCustomerId,
  });
  await prisma.topUp.update({ where: { id: topUp.id }, data: { paypalOrderId: order.id } });
  return { orderId: order.id, topUpId: topUp.id };
}

/** Captures an approved top-up order and credits the wallet. */
export async function finishTopUp(orderId: string) {
  const topUp = await prisma.topUp.findUnique({ where: { paypalOrderId: orderId } });
  if (!topUp) throw new TollgateError(404, "topup_not_found", "Unknown PayPal order.");
  if (topUp.status === "COMPLETED") return { credited: false, alreadyCompleted: true, topUpId: topUp.id };

  let order: PayPalOrder;
  try {
    order = await captureOrder(orderId);
  } catch (err) {
    // A retried capture of an order that was already captured lands here.
    if (err instanceof PayPalError && err.message.startsWith("ORDER_ALREADY_CAPTURED")) {
      return { credited: false, alreadyCompleted: true, topUpId: topUp.id };
    }
    throw err;
  }
  return creditFromOrder(topUp.id, order);
}

/**
 * Credits a wallet from a captured PayPal order. Safe to call more than once
 * for the same top-up (capture response, webhook, retries): only the first
 * call that flips the top-up from CREATED to COMPLETED moves money.
 */
export async function creditFromOrder(topUpId: string, order: PayPalOrder) {
  const capture = firstCapture(order);
  if (!capture || capture.status !== "COMPLETED") {
    await prisma.topUp.updateMany({
      where: { id: topUpId, status: "CREATED" },
      data: { status: "FAILED", failureReason: `capture status ${capture?.status ?? order.status}` },
    });
    throw new TollgateError(402, "capture_not_completed", `PayPal capture is ${capture?.status ?? order.status}.`);
  }

  const vault = order.payment_source?.paypal?.attributes?.vault;
  return creditCapture({
    topUpId,
    captureId: capture.id,
    amountCents: valueToCents(capture.amount.value),
    orderId: order.id,
    vaultId: vault?.status === "VAULTED" ? vault.id : undefined,
    customerId: vault?.customer?.id,
  });
}

export async function creditCapture(opts: {
  topUpId: string;
  captureId: string;
  amountCents: number;
  orderId?: string;
  vaultId?: string;
  customerId?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.topUp.updateMany({
      where: { id: opts.topUpId, status: { not: "COMPLETED" } },
      data: { status: "COMPLETED", captureId: opts.captureId, completedAt: new Date(), failureReason: null },
    });
    if (claimed.count === 0) return { credited: false, alreadyCompleted: true, topUpId: opts.topUpId };

    const topUp = await tx.topUp.findUniqueOrThrow({ where: { id: opts.topUpId } });
    await tx.agent.update({
      where: { id: topUp.agentId },
      data: {
        balanceCents: { increment: opts.amountCents },
        ...(opts.vaultId ? { paypalVaultId: opts.vaultId } : {}),
        ...(opts.customerId ? { paypalCustomerId: opts.customerId } : {}),
      },
    });
    await tx.ledgerEntry.create({
      data: {
        account: accounts.agent(topUp.agentId),
        kind: "TOPUP",
        amountCents: opts.amountCents,
        externalRef: opts.orderId ?? opts.captureId,
        idempotencyKey: `capture:${opts.captureId}`,
      },
    });
    return { credited: true, alreadyCompleted: false, topUpId: opts.topUpId, amountCents: opts.amountCents };
  });
}

/**
 * Tops the wallet up from the saved PayPal account when the balance is below
 * the operator's threshold. Returns null when nothing needed doing.
 */
export async function autoRecharge(agentId: string, opts: { force?: boolean } = {}) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent?.paypalVaultId || !agent.autoRechargeAmountCents || agent.autoRechargeThresholdCents == null) return null;
  if (!opts.force && agent.balanceCents >= agent.autoRechargeThresholdCents) return null;

  // Don't stack recharges: skip if one started in the last minute.
  const recent = await prisma.topUp.findFirst({
    where: { agentId, automatic: true, createdAt: { gte: new Date(Date.now() - 60_000) } },
  });
  if (recent) return null;

  const topUp = await prisma.topUp.create({
    data: { agentId, amountCents: agent.autoRechargeAmountCents, automatic: true },
  });

  try {
    let order = await chargeVaultedPayPal({
      topUpId: topUp.id,
      agentId,
      amountCents: topUp.amountCents,
      vaultId: agent.paypalVaultId,
    });
    await prisma.topUp.update({ where: { id: topUp.id }, data: { paypalOrderId: order.id } });
    if (order.status !== "COMPLETED") order = await captureOrder(order.id);
    return await creditFromOrder(topUp.id, order);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await prisma.topUp.updateMany({ where: { id: topUp.id, status: "CREATED" }, data: { status: "FAILED", failureReason: reason } });
    console.error("auto-recharge failed", { agentId, reason });
    return null;
  }
}
