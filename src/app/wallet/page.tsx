import { Suspense } from "react";
import { PayPalTopUp } from "@/components/paypal-top-up";
import { prisma } from "@/lib/db";
import { DEMO_MODE } from "@/lib/demo";
import { formatCents } from "@/lib/money";
import { accounts } from "@/lib/tollgate/service";
import { disableAutoRecharge, forgetPayPal, keepFrozen, saveAutoRecharge, unfreezeAgent } from "./actions";
import { CreateAgentForm } from "./create-agent-form";

export default function WalletPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Agent wallets</h1>
      <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
        Fund your AI agents with PayPal. Agents spend from this balance when a Tollgate site asks for payment, so tiny
        per-article prices don&apos;t each become a separate card charge.
      </p>

      <Suspense fallback={<p className="mt-8 text-zinc-500">Loading wallets…</p>}>
        <AgentList />
      </Suspense>

      <div className="mt-10">
        <CreateAgentForm />
      </div>
    </main>
  );
}

async function AgentList() {
  const agents = await prisma.agent.findMany({
    orderBy: { createdAt: "asc" },
    include: { riskEvents: { orderBy: { createdAt: "desc" }, take: 3 } },
  });
  const ledger = await prisma.ledgerEntry.findMany({
    where: { account: { in: agents.map((a) => accounts.agent(a.id)) } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  if (agents.length === 0) return <p className="mt-8 text-zinc-500">No agents yet. Create one below.</p>;

  return (
    <div className="mt-8 space-y-6">
      {agents.map((agent) => {
        const activity = ledger.filter((e) => e.account === accounts.agent(agent.id)).slice(0, 8);
        const autoOn = agent.autoRechargeAmountCents != null && agent.autoRechargeThresholdCents != null;

        return (
          <section key={agent.id} className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{agent.name}</h2>
                <p className="mt-1 font-mono text-xs text-zinc-500">{agent.apiKeyPrefix}…</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-zinc-500">Balance</p>
                <p className="text-3xl font-bold tabular-nums">${(agent.balanceCents / 100).toFixed(2)}</p>
                {agent.dailyBudgetCents != null && (
                  <p className="text-xs text-zinc-500">Daily budget {formatCents(agent.dailyBudgetCents)}</p>
                )}
              </div>
            </div>

            {agent.frozenAt && <FrozenBanner agentId={agent.id} reason={agent.frozenReason} event={agent.riskEvents[0]} />}

            {!agent.frozenAt && agent.riskEvents.length > 0 && (
              <p className="mt-4 text-xs text-zinc-500">
                🛡 Spend Guardian: last check {agent.riskEvents[0].decision.toLowerCase()} (risk {agent.riskEvents[0].score}) ·{" "}
                {agent.riskEvents[0].resolution ?? agent.riskEvents[0].summary}
              </p>
            )}

            <div className="mt-6 grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Top up with PayPal</h3>
                <PayPalTopUp agentId={agent.id} hasSavedPayPal={!!agent.paypalVaultId} />
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Auto-recharge</h3>
                {agent.paypalVaultId ? (
                  <div className="space-y-3 text-sm">
                    <p className="text-emerald-700 dark:text-emerald-400">PayPal saved for this agent.</p>
                    <form action={saveAutoRecharge} className="flex flex-wrap items-end gap-3">
                      <input type="hidden" name="agentId" value={agent.id} />
                      <label>
                        <span className="block text-zinc-500">When below ($)</span>
                        <input name="threshold" type="number" min="0" max="100" step="0.5" defaultValue={((agent.autoRechargeThresholdCents ?? 100) / 100).toFixed(2)} className="mt-1 w-24 rounded-lg border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700" />
                      </label>
                      <label>
                        <span className="block text-zinc-500">Add ($)</span>
                        <input name="amount" type="number" min="1" max="100" step="1" defaultValue={((agent.autoRechargeAmountCents ?? 500) / 100).toFixed(0)} className="mt-1 w-24 rounded-lg border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700" />
                      </label>
                      <button className="rounded-lg bg-zinc-900 px-3 py-1.5 font-medium text-white dark:bg-white dark:text-zinc-900">
                        {autoOn ? "Update" : "Turn on"}
                      </button>
                    </form>
                    <p className="text-zinc-500">
                      {autoOn
                        ? `On: adds ${formatCents(agent.autoRechargeAmountCents!)} when the balance drops below ${formatCents(agent.autoRechargeThresholdCents!)}.`
                        : "Off."}
                    </p>
                    <div className="flex gap-3">
                      {autoOn && (
                        <form action={disableAutoRecharge}>
                          <input type="hidden" name="agentId" value={agent.id} />
                          <button className="text-zinc-600 underline dark:text-zinc-400">Turn off</button>
                        </form>
                      )}
                      {!DEMO_MODE && (
                        <form action={forgetPayPal}>
                          <input type="hidden" name="agentId" value={agent.id} />
                          <button className="text-red-600 underline">Remove saved PayPal</button>
                        </form>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">
                    Tick &ldquo;Save my PayPal&rdquo; on your next top-up to let this wallet refill itself.
                  </p>
                )}
              </div>
            </div>

            <h3 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500">Recent activity</h3>
            {activity.length === 0 ? (
              <p className="text-sm text-zinc-500">Nothing yet.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
                {activity.map((e) => (
                  <li key={e.id} className="flex justify-between py-2">
                    <span>
                      {e.kind === "TOPUP" ? "PayPal top-up" : "Paid for content"}
                      <span className="ml-2 text-zinc-500">{e.createdAt.toLocaleString("en-US")}</span>
                    </span>
                    <span className={`tabular-nums ${e.amountCents > 0 ? "text-emerald-600" : ""}`}>
                      {e.amountCents > 0 ? "+" : "−"}${(Math.abs(e.amountCents) / 100).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function FrozenBanner({
  agentId,
  reason,
  event,
}: {
  agentId: string;
  reason: string | null;
  event?: { id: string; score: number; signals: unknown; aiNote: string | null };
}) {
  const signals = Array.isArray(event?.signals) ? (event.signals as { reason: string }[]) : [];
  return (
    <div className="mt-5 rounded-xl border-2 border-red-500/50 bg-red-50 p-4 text-sm dark:bg-red-950/40">
      <p className="font-semibold text-red-700 dark:text-red-300">
        🛡 Wallet frozen by Spend Guardian{event ? ` · risk ${Math.round(event.score * 100)}%` : ""}
      </p>
      {signals.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-700 dark:text-zinc-300">
          {signals.map((s, i) => (
            <li key={i}>{s.reason}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-zinc-700 dark:text-zinc-300">{reason}</p>
      )}
      {event?.aiNote && <p className="mt-3 italic text-zinc-600 dark:text-zinc-400">AI note: {event.aiNote}</p>}
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">No payments or auto-recharges happen until you decide.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <form action={unfreezeAgent}>
          <input type="hidden" name="agentId" value={agentId} />
          {event && <input type="hidden" name="eventId" value={event.id} />}
          <button className="rounded-lg bg-zinc-900 px-3 py-1.5 font-medium text-white dark:bg-white dark:text-zinc-900">
            It was me, unfreeze
          </button>
        </form>
        <form action={keepFrozen}>
          {event && <input type="hidden" name="eventId" value={event.id} />}
          <button className="rounded-lg border border-red-400 px-3 py-1.5 font-medium text-red-700 dark:text-red-300">Keep frozen</button>
        </form>
      </div>
    </div>
  );
}
