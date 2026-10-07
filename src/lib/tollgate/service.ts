import { prisma } from "@/lib/db";
import { centsToMoney } from "@/lib/money";
import { hashAgentKey } from "./keys";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  PLATFORM_FEE_BPS,
  QUOTE_TTL_SECONDS,
  fromDbLicense,
  toDbLicense,
  type LicenseType,
  type PayResponse,
  type QuoteResponse,
} from "./protocol";
import { signAccessToken } from "./token";

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
  | { kind: "quote"; body: QuoteResponse; resourceId: string };

export async function issueQuote(opts: {
  path: string;
  license: LicenseType;
  origin: string;
  botName?: string;
  reason?: QuoteResponse["reason"];
}): Promise<GateQuote> {
  const resource = await prisma.resource.findUnique({ where: { path: opts.path } });
  if (!resource) return { kind: "not_found" };

  const priceCents = opts.license === "train" ? resource.priceTrainCents : resource.priceReadCents;
  if (priceCents <= 0) return { kind: "free" };

  const quote = await prisma.quote.create({
    data: {
      resourceId: resource.id,
      license: toDbLicense(opts.license),
      priceCents,
      botName: opts.botName,
      expiresAt: new Date(Date.now() + QUOTE_TTL_SECONDS * 1000),
    },
  });

  return {
    kind: "quote",
    resourceId: resource.id,
    body: {
      error: "payment_required",
      quote_id: quote.id,
      resource: resource.path,
      title: resource.title,
      license: opts.license,
      price: centsToMoney(priceCents),
      teaser: resource.teaser,
      pay_url: `${opts.origin}/api/tollgate/pay`,
      expires_at: quote.expiresAt.toISOString(),
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

  const quote = await prisma.quote.findUnique({ where: { id: opts.quoteId }, include: { resource: true } });
  if (!quote) throw new TollgateError(404, "quote_not_found", "No quote with that id.");
  if (quote.status === "PAID") throw new TollgateError(409, "quote_already_paid", "This quote was already paid.");
  if (quote.expiresAt <= new Date()) {
    throw new TollgateError(410, "quote_expired", "Quote expired. Request the resource again for a fresh quote.");
  }

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

  // Everything below commits together or not at all. The conditional
  // updateMany calls are the concurrency guards: a quote can only be claimed
  // once, and a wallet can never go below zero.
  const { grant, balanceCents } = await prisma.$transaction(async (tx) => {
    const claimed = await tx.quote.updateMany({
      where: { id: quote.id, status: "OPEN", expiresAt: { gt: now } },
      data: { status: "PAID", paidAt: now, agentId: agent.id },
    });
    if (claimed.count === 0) throw new TollgateError(409, "quote_already_paid", "This quote was already paid.");

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
      where: { id: quote.resource.publisherId },
      data: { balanceCents: { increment: net } },
    });

    await tx.ledgerEntry.createMany({
      data: [
        { account: accounts.agent(agent.id), kind: "CHARGE", amountCents: -price, quoteId: quote.id },
        { account: accounts.publisher(quote.resource.publisherId), kind: "EARNING", amountCents: net, quoteId: quote.id },
        { account: accounts.platform, kind: "FEE", amountCents: fee, quoteId: quote.id },
      ],
    });

    const grant = await tx.accessGrant.create({
      data: {
        quoteId: quote.id,
        agentId: agent.id,
        resourceId: quote.resourceId,
        license: quote.license,
        priceCents: price,
      },
    });

    const after = await tx.agent.findUniqueOrThrow({ where: { id: agent.id }, select: { balanceCents: true } });
    return { grant, balanceCents: after.balanceCents };
  });

  const license = fromDbLicense(quote.license);
  const accessToken = await signAccessToken({
    resource: quote.resource.path,
    license,
    grantId: grant.id,
    agentId: agent.id,
  });

  return {
    access_token: accessToken,
    token_type: "Tollgate",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    resource: quote.resource.path,
    license,
    charged: centsToMoney(price),
    balance: centsToMoney(balanceCents),
  };
}

export async function recordVisit(data: {
  path: string;
  userAgent: string;
  botName?: string;
  resourceId?: string;
  outcome: "QUOTED" | "PAID_ACCESS" | "FREE_ACCESS";
}) {
  try {
    await prisma.botVisit.create({ data });
  } catch (err) {
    // Analytics must never break the gate.
    console.error("recordVisit failed", err);
  }
}
