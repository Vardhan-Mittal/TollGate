import { Suspense } from "react";
import { PayPalTopUp } from "@/components/paypal-top-up";
import { PageHeader, PageShell, SectionLabel, ui } from "@/components/ui/kit";
import { prisma } from "@/lib/db";
import { DEMO_MODE } from "@/lib/demo";
import { demoAgentKeyHash } from "@/lib/demo-agent";
import { SIMULATION_AGENT_ID } from "@/lib/guardian-simulation";
import { formatCents } from "@/lib/money";
import { accounts } from "@/lib/tollgate/service";
import { forgetPayPal, keepFrozen, unfreezeAgent } from "./actions";
import { AutoRechargeControls } from "./auto-recharge-controls";
import { CreateAgentForm } from "./create-agent-form";

// Visitor-created wallets shown below the two demo wallets (the public demo has no sign-in).
const RECENT_AGENTS = 10;

export default function WalletPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Agent wallet"
        title="Agent wallets,"
        accent="funded by PayPal."
        description={
          <>
            Agents spend from this balance when a Tollgate site asks for payment, so tiny per-article prices don&apos;t each
            become a separate card charge.
          </>
        }
      />

      <Suspense fallback={<p className={`mt-12 text-sm ${ui.muted}`}>Loading wallets…</p>}>
        <AgentList />
      </Suspense>

      <div className="mt-12">
        <CreateAgentForm />
      </div>
    </PageShell>
  );
}

async function AgentList() {
  const demoHash = demoAgentKeyHash();
  const include = { riskEvents: { orderBy: { createdAt: "desc" as const }, take: 3 } };
  const isPinned = { OR: [{ id: SIMULATION_AGENT_ID }, ...(demoHash ? [{ apiKeyHash: demoHash }] : [])] };
  const [pinned, recent] = await Promise.all([
    prisma.agent.findMany({ where: isPinned, include }),
    prisma.agent.findMany({ where: { NOT: isPinned }, orderBy: { createdAt: "desc" }, take: RECENT_AGENTS, include }),
  ]);
  // Demo wallet first, then the Guardian simulation wallet, then the newest visitor agents.
  pinned.sort((a, b) => Number(b.apiKeyHash === demoHash) - Number(a.apiKeyHash === demoHash));
  const agents = [...pinned, ...recent];
  const ledger = await prisma.ledgerEntry.findMany({
    where: { account: { in: agents.map((a) => accounts.agent(a.id)) } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  if (agents.length === 0) return <p className={`mt-12 text-sm ${ui.muted}`}>No agents yet. Create one below.</p>;

  return (
    <div className="mt-12 flex flex-col gap-6">
      {agents.map((agent) => {
        const activity = ledger.filter((e) => e.account === accounts.agent(agent.id)).slice(0, 8);
        const autoOn = agent.autoRechargeAmountCents != null && agent.autoRechargeThresholdCents != null;
        const sharedDemo = DEMO_MODE && agent.apiKeyHash === demoHash;

        return (
          <section key={agent.id} className={`${ui.card} p-5 sm:p-7`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold tracking-tight">{agent.name}</h2>
                <p className="mt-1 font-mono text-xs text-zinc-500">{agent.apiKeyPrefix}…</p>
              </div>
              <div className="sm:text-right">
                <p className={ui.label}>Balance</p>
                <p className="mt-1 font-mono text-3xl font-medium tracking-tight tabular-nums">
                  ${(agent.balanceCents / 100).toFixed(2)}
                </p>
                {agent.dailyBudgetCents != null && (
                  <p className="mt-1 text-xs text-zinc-500">Daily budget {formatCents(agent.dailyBudgetCents)}</p>
                )}
              </div>
            </div>

            {agent.frozenAt && <FrozenBanner agentId={agent.id} reason={agent.frozenReason} event={agent.riskEvents[0]} />}

            {!agent.frozenAt && agent.riskEvents.length > 0 && (
              <p className="mt-5 text-xs text-pretty text-zinc-500">
                🛡 Spend Guardian: last check {agent.riskEvents[0].decision.toLowerCase()} (risk {agent.riskEvents[0].score}) ·{" "}
                {agent.riskEvents[0].resolution ?? agent.riskEvents[0].summary}
              </p>
            )}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className={`${ui.inset} p-4 sm:p-5`}>
                <SectionLabel>Top up with PayPal</SectionLabel>
                <PayPalTopUp agentId={agent.id} hasSavedPayPal={!!agent.paypalVaultId} />
              </div>

              <div className={`${ui.inset} p-4 sm:p-5`}>
                <SectionLabel>Auto-recharge</SectionLabel>
                {agent.paypalVaultId ? (
                  <div className="flex flex-col gap-3 text-sm">
                    <p>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        PayPal saved for this agent.
                      </span>
                    </p>
                    {!sharedDemo && (
                      <AutoRechargeControls
                        agentId={agent.id}
                        thresholdCents={agent.autoRechargeThresholdCents}
                        amountCents={agent.autoRechargeAmountCents}
                        maxAmountDollars={DEMO_MODE ? 5 : 100}
                      />
                    )}
                    <p className="text-zinc-500">
                      {autoOn
                        ? `On: adds ${formatCents(agent.autoRechargeAmountCents!)} when the balance drops below ${formatCents(agent.autoRechargeThresholdCents!)}.`
                        : "Off."}
                    </p>
                    {sharedDemo && (
                      <p className="text-pretty text-zinc-500">
                        Fixed on the shared demo wallet so every visitor&apos;s run can pay. Create your own agent below to try it.
                      </p>
                    )}
                    {!DEMO_MODE && (
                      <form action={forgetPayPal}>
                        <input type="hidden" name="agentId" value={agent.id} />
                        <button className="text-xs text-red-600 underline underline-offset-2 hover:text-red-700 dark:text-red-400">
                          Remove saved PayPal
                        </button>
                      </form>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-pretty text-zinc-500">
                    Tick &ldquo;Save my PayPal&rdquo; on your next top-up to let this wallet refill itself.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-8">
              <SectionLabel>Recent activity</SectionLabel>
              {activity.length === 0 ? (
                <p className="text-sm text-zinc-500">Nothing yet.</p>
              ) : (
                <ul className="divide-y divide-zinc-200/70 border-t border-zinc-200/70 text-sm dark:divide-white/[0.06] dark:border-white/[0.06]">
                  {activity.map((e) => (
                    <li key={e.id} className="flex items-baseline justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        {e.kind === "TOPUP" ? (e.externalRef === "simulation-credit" ? "Test credit (simulation)" : "PayPal top-up") : "Paid for content"}
                        <span className="ml-2 font-mono text-xs text-zinc-500">{e.createdAt.toLocaleString("en-US")}</span>
                      </span>
                      <span
                        className={`shrink-0 font-mono tabular-nums ${e.amountCents > 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}
                      >
                        {e.amountCents > 0 ? "+" : "−"}${(Math.abs(e.amountCents) / 100).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
    <div className="relative mt-6 overflow-hidden rounded-xl border border-red-500/25 bg-red-500/[0.04] p-4 pl-5 text-sm sm:p-5 sm:pl-6 dark:border-red-400/20 dark:bg-red-500/[0.06]">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-red-500/70" />
      <p className="font-medium text-red-700 dark:text-red-300">
        🛡 Wallet frozen by Spend Guardian{event ? ` · risk ${Math.round(event.score * 100)}%` : ""}
      </p>
      {signals.length > 0 ? (
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-zinc-700 marker:text-red-400 dark:text-zinc-300">
          {signals.map((s, i) => (
            <li key={i}>{s.reason}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-zinc-700 dark:text-zinc-300">{reason}</p>
      )}
      {event?.aiNote && <p className="mt-3 font-serif text-[17px] leading-snug italic text-zinc-600 dark:text-zinc-400">AI note: {event.aiNote}</p>}
      <p className={`mt-3 ${ui.muted}`}>No payments or auto-recharges happen until you decide.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <form action={unfreezeAgent}>
          <input type="hidden" name="agentId" value={agentId} />
          {event && <input type="hidden" name="eventId" value={event.id} />}
          <button className={ui.btnPrimary}>It was me, unfreeze</button>
        </form>
        <form action={keepFrozen}>
          <input type="hidden" name="agentId" value={agentId} />
          {event && <input type="hidden" name="eventId" value={event.id} />}
          <button className="inline-flex items-center justify-center rounded-full border border-red-500/40 px-5 py-2.5 text-sm font-medium text-red-700 transition-colors hover:border-red-500/70 hover:bg-red-500/[0.06] dark:border-red-400/30 dark:text-red-300 dark:hover:border-red-400/60">
            Keep frozen
          </button>
        </form>
      </div>
    </div>
  );
}
