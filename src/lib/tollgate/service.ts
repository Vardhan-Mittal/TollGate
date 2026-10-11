import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
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

  if (agent.dailyBudgetCents != null) {
    const spent = await prisma.ledgerEntry.aggregate({
      _sum: { amountCents: true },
      where: { account: accounts.agent(agent.id), kind: "CHARGE", createdAt: { gte: startOfUtcDay() } },
    });
    const spentCents = -(spent._sum.amountCents ?? 0);
    if (spentCents + price > agent.dailyBudgetCents) {
      throw new TollgateError(402, "daily_budget_exceeded", "This payment would exceed the agent's daily budget.", {
        daily_budget: centsToMoney(agent.dailyBudgetCents),
        spent_today: centsToMoney(spentCents),
      });
    }
  }

  const fee = Math.floor((price * PLATFORM_FEE_BPS) / 10_000);
  const net = price - fee;
  const now = new Date();

  // Everything below commits together or not at all. Two concurrency guards:
  // storing the quote under its signed id means a second payment of the same
  // quote violates the primary key, and the conditional wallet update means a
  // balance can never go below zero.
  const { grant, balanceCents } = await prisma
    .$transaction(async (tx) => {
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
          balance: centsToMoney(agent.balanceCents),
          price: centsToMoney(price),
          topup_url: `${opts.origin}/wallet`,
        });
      }

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
      return { grant, balanceCents: after.balanceCents };
    })
    .catch((err) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new TollgateError(409, "quote_already_paid", "This quote was already paid.");
      }
      throw err;
    });

  const license = quote.license;
  const accessToken = await signAccessToken({
    resource: quote.resource,
    license,
    grantId: grant.id,
    agentId: agent.id,
  });

  return {
    access_token: accessToken,
    token_type: "Tollgate",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    resource: quote.resource,
    license,
    charged: centsToMoney(price),
    balance: centsToMoney(balanceCents),
  };
}

export { recordVisit } from "./visit-log";
