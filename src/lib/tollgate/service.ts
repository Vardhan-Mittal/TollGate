import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { assessPayment, recordRisk, type Assessment } from "@/lib/guardian";
import { SIMULATION_AGENT_ID } from "@/lib/guardian-simulation";
import { centsToMoney } from "@/lib/money";
import { hashAgentKey } from "./keys";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  PLATFORM_FEE_BPS,
  QUOTE_TTL_SECONDS,
  toDbLicense,
  type LicenseType,
  type PayResponse,
  type QuoteResponse,
} from "./protocol";
import { getResourceByPath } from "./resource-cache";
import { signAccessToken, signQuoteToken, verifyQuoteToken } from "./token";

export class TollgateError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }

  toJSON() {
    return { error: this.code, message: this.message, ...this.extra };
  }
}

export const accounts = {
  agent: (id: string) => `agent:${id}`,
  publisher: (id: string) => `publisher:${id}`,
  platform: "platform",
  /** Where the runaway-agent simulation's test-credit purchases land; not a real publisher. */
  simulation: "publisher:simulation",
};

export type GateQuote =
  | { kind: "not_found" }
  | { kind: "free" }
  | { kind: "quote"; body: QuoteResponse; resourceId: string; priceCents: number };

export async function issueQuote(opts: {
  path: string;
  license: LicenseType;
  origin: string;
  botName?: string;
  reason?: QuoteResponse["reason"];
}): Promise<GateQuote> {
  const resource = await getResourceByPath(opts.path);
  if (!resource) return { kind: "not_found" };

  const priceCents = opts.license === "train" ? resource.priceTrainCents : resource.priceReadCents;
  if (priceCents <= 0) return { kind: "free" };

  // No database write: the quote is a signed, expiring token. It is stored
  // only if an agent pays it.
  const quoteId = await signQuoteToken(
    { quoteId: randomUUID(), resourceId: resource.id, resource: resource.path, license: opts.license, priceCents, botName: opts.botName },
    QUOTE_TTL_SECONDS,
  );
  const expiresAt = new Date(Date.now() + QUOTE_TTL_SECONDS * 1000);

  return {
    kind: "quote",
    resourceId: resource.id,
    priceCents,
    body: {
      error: "payment_required",
      quote_id: quoteId,
      resource: resource.path,
      title: resource.title,
      license: opts.license,
      price: centsToMoney(priceCents),
      teaser: resource.teaser,
      pay_url: `${opts.origin}/api/tollgate/pay`,
      expires_at: expiresAt.toISOString(),
      ...(opts.reason ? { reason: opts.reason } : {}),
    },
  };
}

export async function findAgentByKey(key: string) {
  const agent = await prisma.agent.findUnique({ where: { apiKeyHash: hashAgentKey(key) } });
  if (!agent) throw new TollgateError(401, "invalid_agent_key", "Unknown or revoked agent API key.");
  return agent;
}

/**
 * A licence an agent bought stays good for the access-token lifetime: within it,
 * re-opening the page issues a new token for the same grant instead of a second sale.
 * Returns null when the agent holds no such licence.
 */
export async function reissueAccess(opts: { agentKey: string; path: string; license: LicenseType }) {
  const agent = await findAgentByKey(opts.agentKey);
  const resource = await getResourceByPath(opts.path);
  if (!resource) return null;
  const grant = await prisma.accessGrant.findFirst({
    where: {
      agentId: agent.id,
      resourceId: resource.id,
      license: toDbLicense(opts.license),
      createdAt: { gte: new Date(Date.now() - ACCESS_TOKEN_TTL_SECONDS * 1000) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!grant) return null;
  const accessToken = await signAccessToken({ resource: opts.path, license: opts.license, grantId: grant.id, agentId: agent.id });
  return { accessToken, boughtAt: grant.createdAt, priceCents: grant.priceCents };
}

type PayOutcome =
  | { kind: "paid"; grantId: string; balanceCents: number }
  | { kind: "frozen"; reason: string | null }
  | { kind: "held"; risk: Assessment; eventId: string };

function startOfUtcDay() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function payQuote(opts: { agentKey: string; quoteId: string; origin: string }): Promise<PayResponse> {
  const agent = await findAgentByKey(opts.agentKey);

  const verified = await verifyQuoteToken(opts.quoteId);
  if (!verified.ok) {
    if (verified.reason === "quote_expired") {
      throw new TollgateError(410, "quote_expired", "Quote expired. Request the resource again for a fresh quote.");
    }
    throw new TollgateError(404, "quote_not_found", "Not a valid Tollgate quote.");
  }
  const quote = verified.claims;
  const resource = await prisma.resource.findUnique({ where: { id: quote.resourceId }, select: { publisherId: true } });
  if (!resource) throw new TollgateError(404, "quote_not_found", "The quoted resource no longer exists.");

  const price = quote.priceCents;
  const reviewUrl = `${opts.origin}/wallet`;
  const fee = Math.floor((price * PLATFORM_FEE_BPS) / 10_000);
  const net = price - fee;
  const now = new Date();
  // The runaway-agent simulation pays with test credit: its purchases go to a
  // separate ledger account and never reach a real publisher's balance.
  const simulated = agent.id === SIMULATION_AGENT_ID;
  const payment = { resourceId: quote.resourceId, priceCents: price };
  let flagged: Assessment | null = null;

  // Everything below commits together or not at all. Concurrency guards:
  // - an advisory lock serialises payments per agent, so the frozen flag, the
  //   Spend Guardian and the daily budget each see every earlier payment;
  // - storing the quote under its signed id means a second payment of the
  //   same quote violates the primary key;
  // - the conditional wallet update means a balance can never go below zero.
  let outcome: PayOutcome;
  try {
    outcome = await prisma
      .$transaction(
        async (tx): Promise<PayOutcome> => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${agent.id}::text))`;

          // Spend Guardian: a frozen wallet pays nothing until its owner reviews it,
          // and every payment is risk-scored against the agent's own history first.
          const current = await tx.agent.findUniqueOrThrow({
            where: { id: agent.id },
            select: { frozenAt: true, frozenReason: true, dailyBudgetCents: true, balanceCents: true },
          });
          if (current.frozenAt) return { kind: "frozen", reason: current.frozenReason };

          const risk = await assessPayment({ agentId: agent.id, resourceId: quote.resourceId, priceCents: price, now }, tx);
          if (risk.decision === "HOLD") {
            // Committed together with the freeze; turned into a 423 below.
            const event = await recordRisk(agent.id, risk, payment, tx);
            return { kind: "held", risk, eventId: event.id };
          }
          if (risk.decision === "FLAG") flagged = risk;

          if (current.dailyBudgetCents != null) {
            const spent = await tx.ledgerEntry.aggregate({
              _sum: { amountCents: true },
              where: { account: accounts.agent(agent.id), kind: "CHARGE", createdAt: { gte: startOfUtcDay() } },
            });
            const spentCents = -(spent._sum.amountCents ?? 0);
            if (spentCents + price > current.dailyBudgetCents) {
              throw new TollgateError(402, "daily_budget_exceeded", "This payment would exceed the agent's daily budget.", {
                daily_budget: centsToMoney(current.dailyBudgetCents),
                spent_today: centsToMoney(spentCents),
              });
            }
          }

          await tx.quote.create({
            data: {
              id: quote.quoteId,
              resourceId: quote.resourceId,
              license: toDbLicense(quote.license),
              priceCents: price,
              botName: quote.botName,
              status: "PAID",
              paidAt: now,
              agentId: agent.id,
              expiresAt: verified.expiresAt,
            },
          });

          const debited = await tx.agent.updateMany({
            where: { id: agent.id, balanceCents: { gte: price } },
            data: { balanceCents: { decrement: price } },
          });
          if (debited.count === 0) {
            throw new TollgateError(402, "insufficient_funds", "Wallet balance is too low. Top up with PayPal.", {
              balance: centsToMoney(current.balanceCents),
              price: centsToMoney(price),
              topup_url: `${opts.origin}/wallet`,
            });
          }

          if (simulated) {
            await tx.ledgerEntry.createMany({
              data: [
                { account: accounts.agent(agent.id), kind: "CHARGE", amountCents: -price, quoteId: quote.quoteId },
                { account: accounts.simulation, kind: "EARNING", amountCents: price, quoteId: quote.quoteId },
              ],
            });
          } else {
            await tx.publisher.update({
              where: { id: resource.publisherId },
              data: { balanceCents: { increment: net } },
            });
            await tx.ledgerEntry.createMany({
              data: [
                { account: accounts.agent(agent.id), kind: "CHARGE", amountCents: -price, quoteId: quote.quoteId },
                { account: accounts.publisher(resource.publisherId), kind: "EARNING", amountCents: net, quoteId: quote.quoteId },
                { account: accounts.platform, kind: "FEE", amountCents: fee, quoteId: quote.quoteId },
              ],
            });
          }

          const grant = await tx.accessGrant.create({
            data: {
              quoteId: quote.quoteId,
              agentId: agent.id,
              resourceId: quote.resourceId,
              license: toDbLicense(quote.license),
              priceCents: price,
            },
          });

          const after = await tx.agent.findUniqueOrThrow({ where: { id: agent.id }, select: { balanceCents: true } });
          return { kind: "paid", grantId: grant.id, balanceCents: after.balanceCents };
        },
        // Payments of one agent queue on the lock, so allow more than the 5 s default.
        { maxWait: 10_000, timeout: 15_000 },
      )
      .catch((err) => {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new TollgateError(409, "quote_already_paid", "This quote was already paid.");
        }
        throw err;
      });
  } finally {
    // A flag is kept whether or not the payment then went through.
    const flag = flagged as Assessment | null;
    if (flag) await recordRisk(agent.id, flag, payment).catch((err) => console.error("recording risk flag failed", err));
  }

  if (outcome.kind === "frozen") {
    throw new TollgateError(423, "wallet_frozen", `Spend Guardian froze this wallet: ${outcome.reason ?? "unusual activity"}`, {
      review_url: reviewUrl,
    });
  }
  if (outcome.kind === "held") {
    throw new TollgateError(423, "payment_held", "Spend Guardian held this payment and froze the wallet for review.", {
      risk_score: outcome.risk.score,
      signals: outcome.risk.signals.map((s) => s.reason),
      risk_event_id: outcome.eventId,
      review_url: reviewUrl,
    });
  }

  const license = quote.license;
  const accessToken = await signAccessToken({
    resource: quote.resource,
    license,
    grantId: outcome.grantId,
    agentId: agent.id,
  });

  return {
    access_token: accessToken,
    token_type: "Tollgate",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    resource: quote.resource,
    license,
    charged: centsToMoney(price),
    balance: centsToMoney(outcome.balanceCents),
  };
}

export { recordVisit } from "./visit-log";
