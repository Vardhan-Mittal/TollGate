import "server-only";
import { prisma } from "@/lib/db";
import { DEMO_MODE } from "@/lib/demo";
import { hashAgentKey } from "@/lib/tollgate/keys";

// The shared demo wallet (DEMO_AGENT_KEY) that /live, /agent and the deal demo pay from.

/** Hash of the demo agent's key, or null when DEMO_AGENT_KEY is not set. */
export function demoAgentKeyHash() {
  const key = process.env.DEMO_AGENT_KEY;
  return key ? hashAgentKey(key) : null;
}

export function isDemoAgent(agent: { apiKeyHash: string }) {
  return agent.apiKeyHash === demoAgentKeyHash();
}

/**
 * In the public demo, a Spend Guardian freeze on the shared wallet would break
 * every later visitor's run, so it is cleared before each run. The Guardian demo
 * itself runs on the separate simulation wallet.
 */
export async function restoreDemoAgent(agent: { id: string; frozenAt: Date | null }) {
  if (!DEMO_MODE || !agent.frozenAt) return;
  await prisma.$transaction([
    prisma.agent.update({ where: { id: agent.id }, data: { frozenAt: null, frozenReason: null } }),
    prisma.riskEvent.updateMany({
      where: { agentId: agent.id, resolvedAt: null },
      data: { resolution: "Auto-cleared for the public demo run.", resolvedAt: new Date() },
    }),
  ]);
}
