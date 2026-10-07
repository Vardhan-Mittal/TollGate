"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { DEMO_MODE } from "@/lib/demo";
import { deletePaymentToken } from "@/lib/paypal/vault";
import { generateAgentKey } from "@/lib/tollgate/keys";

export type CreateAgentState = { key?: string; name?: string; error?: string };

export async function createAgent(_prev: CreateAgentState, form: FormData): Promise<CreateAgentState> {
  const name = z.string().trim().min(2).max(60).safeParse(form.get("name"));
  if (!name.success) return { error: "Give the agent a name (2–60 characters)." };

  const budget = Number(form.get("dailyBudget") || 0);
  const { key, hash, prefix } = generateAgentKey();
  await prisma.agent.create({
    data: {
      name: name.data,
      apiKeyHash: hash,
      apiKeyPrefix: prefix,
      dailyBudgetCents: budget > 0 ? Math.round(budget * 100) : null,
    },
  });
  refresh();
  // The plain key is shown once and never stored.
  return { key, name: name.data };
}

const AutoRecharge = z.object({
  agentId: z.string().min(1),
  threshold: z.coerce.number().min(0).max(100),
  amount: z.coerce.number().min(1).max(100),
});

export async function saveAutoRecharge(form: FormData) {
  const parsed = AutoRecharge.safeParse(Object.fromEntries(form));
  if (!parsed.success) return;
  const { agentId, threshold, amount } = parsed.data;
  await prisma.agent.update({
    where: { id: agentId },
    data: {
      autoRechargeThresholdCents: Math.round(threshold * 100),
      autoRechargeAmountCents: Math.round(amount * 100),
    },
  });
  refresh();
}

export async function disableAutoRecharge(form: FormData) {
  const agentId = String(form.get("agentId"));
  await prisma.agent.update({
    where: { id: agentId },
    data: { autoRechargeThresholdCents: null, autoRechargeAmountCents: null },
  });
  refresh();
}

export async function forgetPayPal(form: FormData) {
  // Keeps the shared demo wallet able to auto-recharge for every visitor.
  if (DEMO_MODE) return;
  const agentId = String(form.get("agentId"));
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (agent?.paypalVaultId) await deletePaymentToken(agent.paypalVaultId);
  await prisma.agent.update({
    where: { id: agentId },
    data: { paypalVaultId: null, autoRechargeThresholdCents: null, autoRechargeAmountCents: null },
  });
  refresh();
}
