"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { limitAction } from "@/lib/action-limit";
import { prisma } from "@/lib/db";
import { DEMO_MODE } from "@/lib/demo";
import { isDemoAgent } from "@/lib/demo-agent";
import { deletePaymentToken } from "@/lib/paypal/vault";
import { NAME_PATTERN } from "@/lib/tollgate/bots";
import { generateAgentKey } from "@/lib/tollgate/keys";

// In the public demo nobody signs in, so auto-recharge amounts stay small.
const DEMO_MAX_RECHARGE_DOLLARS = 5;

export type CreateAgentState = { key?: string; name?: string; error?: string };
export type AutoRechargeState = { error?: string; message?: string };

const NewAgent = z.object({
  name: z.string().trim().min(2).max(40).regex(NAME_PATTERN),
  // Dollars; blank means no daily budget.
  dailyBudget: z.coerce.number().min(0).max(1000),
});

export async function createAgent(_prev: CreateAgentState, form: FormData): Promise<CreateAgentState> {
  const parsed = NewAgent.safeParse({ name: form.get("name") ?? "", dailyBudget: form.get("dailyBudget") || 0 });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return field === "dailyBudget"
      ? { error: "Daily budget must be between $0 and $1,000." }
      : { error: "Name: 2–40 letters, numbers, spaces or . _ / ( ) -" };
  }
  const limited = await limitAction("create-agent", 5, 10 * 60_000);
  if (limited) return { error: limited };

  const { name, dailyBudget } = parsed.data;
  const { key, hash, prefix } = generateAgentKey();
  await prisma.agent.create({
    data: {
      name,
      apiKeyHash: hash,
      apiKeyPrefix: prefix,
      dailyBudgetCents: dailyBudget > 0 ? Math.round(dailyBudget * 100) : null,
    },
  });
  refresh();
  // The plain key is shown once and never stored.
  return { key, name };
}

const AgentId = z.string().min(1);

const AutoRecharge = z.object({
  agentId: AgentId,
  threshold: z.coerce.number().min(0).max(100),
  amount: z.coerce.number().min(1).max(100),
});

/** Loads an agent whose money settings a visitor may change, or explains why not. */
async function editableAgent(agentId: string) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) return { error: "No such agent." } as const;
  if (DEMO_MODE && isDemoAgent(agent)) {
    return { error: "Auto-recharge on the shared demo wallet is fixed so every visitor's run can pay. Create your own agent to try it." } as const;
  }
  return { agent } as const;
}

export async function saveAutoRecharge(_prev: AutoRechargeState, form: FormData): Promise<AutoRechargeState> {
  const parsed = AutoRecharge.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Threshold must be $0–$100 and the amount $1–$100." };
  const { agentId, threshold } = parsed.data;
  const amount = DEMO_MODE ? Math.min(parsed.data.amount, DEMO_MAX_RECHARGE_DOLLARS) : parsed.data.amount;

  const found = await editableAgent(agentId);
  if ("error" in found) return { error: found.error };
  await prisma.agent.update({
    where: { id: agentId },
    data: {
      autoRechargeThresholdCents: Math.round(threshold * 100),
      autoRechargeAmountCents: Math.round(amount * 100),
    },
  });
  refresh();
  return amount < parsed.data.amount
    ? { message: `Saved. The public demo caps auto-recharge at $${DEMO_MAX_RECHARGE_DOLLARS}.` }
    : { message: "Saved." };
}

export async function disableAutoRecharge(_prev: AutoRechargeState, form: FormData): Promise<AutoRechargeState> {
  const agentId = AgentId.safeParse(form.get("agentId"));
  if (!agentId.success) return { error: "No such agent." };

  const found = await editableAgent(agentId.data);
  if ("error" in found) return { error: found.error };
  await prisma.agent.update({
    where: { id: agentId.data },
    data: { autoRechargeThresholdCents: null, autoRechargeAmountCents: null },
  });
  refresh();
  return { message: "Auto-recharge is off." };
}

export async function forgetPayPal(form: FormData) {
  // Keeps the shared demo wallet able to auto-recharge for every visitor.
  if (DEMO_MODE) return;
  const agentId = AgentId.safeParse(form.get("agentId"));
  if (!agentId.success) return;
  const agent = await prisma.agent.findUnique({ where: { id: agentId.data } });
  if (!agent) return;
  if (agent.paypalVaultId) await deletePaymentToken(agent.paypalVaultId);
  await prisma.agent.update({
    where: { id: agent.id },
    data: { paypalVaultId: null, autoRechargeThresholdCents: null, autoRechargeAmountCents: null },
  });
  refresh();
}

/** Owner confirms the flagged activity was legitimate: unfreeze the wallet. */
export async function unfreezeAgent(form: FormData) {
  const agentId = AgentId.safeParse(form.get("agentId"));
  if (!agentId.success) return;
  const eventId = form.get("eventId");
  // updateMany: a missing agent is a no-op instead of a P2025 throw.
  await prisma.agent.updateMany({ where: { id: agentId.data }, data: { frozenAt: null, frozenReason: null } });
  if (typeof eventId === "string") {
    // Only an event that belongs to this agent can be resolved.
    await prisma.riskEvent.updateMany({
      where: { id: eventId, agentId: agentId.data },
      data: { resolution: "Owner confirmed it was legitimate and unfroze the wallet.", resolvedAt: new Date() },
    });
  }
  refresh();
}

/** Owner keeps the wallet frozen (e.g. to rotate a leaked key first). */
export async function keepFrozen(form: FormData) {
  const agentId = AgentId.safeParse(form.get("agentId"));
  const eventId = form.get("eventId");
  if (!agentId.success || typeof eventId !== "string") return;
  await prisma.riskEvent.updateMany({
    where: { id: eventId, agentId: agentId.data },
    data: { resolution: "Owner kept the wallet frozen.", resolvedAt: new Date() },
  });
  refresh();
}
