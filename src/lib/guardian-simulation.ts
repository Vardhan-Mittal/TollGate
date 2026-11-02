import "server-only";
import { prisma } from "@/lib/db";
import { generateAgentKey } from "@/lib/tollgate/keys";
import { accounts } from "@/lib/tollgate/service";

// The runaway-agent stress test buys with its own wallet, so the Spend Guardian
// freezing it never touches the demo agent that the other demos pay from.
export const SIMULATION_AGENT_ID = "runaway-simulation";
const SIMULATION_AGENT_NAME = "Runaway Agent (simulation)";
// Enough for a dozen 1¢ loops; the Guardian holds the loop long before that.
const SIMULATION_BALANCE_CENTS = 25;

/**
 * Resets the simulation wallet for a new run and returns a fresh API key for it.
 * Only the key's hash is stored, so each run's key dies with the run.
 */
export async function prepareSimulationAgent() {
  const { key, hash, prefix } = generateAgentKey();

  await prisma.$transaction(async (tx) => {
    const agent = await tx.agent.upsert({
      where: { id: SIMULATION_AGENT_ID },
      create: { id: SIMULATION_AGENT_ID, name: SIMULATION_AGENT_NAME, apiKeyHash: hash, apiKeyPrefix: prefix },
      update: { apiKeyHash: hash, apiKeyPrefix: prefix, frozenAt: null, frozenReason: null },
    });
    await tx.riskEvent.updateMany({
      where: { agentId: agent.id, resolvedAt: null },
      data: { resolution: "Closed when a new simulation run started.", resolvedAt: new Date() },
    });

    // Test credit, not PayPal money: recorded in the ledger as a simulation top-up.
    const topUp = SIMULATION_BALANCE_CENTS - agent.balanceCents;
    if (topUp > 0) {
      await tx.agent.update({ where: { id: agent.id }, data: { balanceCents: { increment: topUp } } });
      await tx.ledgerEntry.create({
        data: { account: accounts.agent(agent.id), kind: "TOPUP", amountCents: topUp, externalRef: "simulation-credit" },
      });
    }
  });

  return { key, agentId: SIMULATION_AGENT_ID, name: SIMULATION_AGENT_NAME };
}
