import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { DEAL_POLICY, invoiceDeal, payerEmailForAgent } from "@/lib/deals";
import { AGENT_MODELS, withModelFallback } from "./models";

export type Side = "buyer" | "publisher";

export type NegotiationEvent =
  | { type: "setup"; dealId: string; articles: number; listPriceCents: number; budgetCents: number; buyer: string; publisher: string }
  | { type: "turn"; side: Side; round: number; action: "offer" | "accept" | "walk_away"; priceCents: number; message: string; guard?: string }
  | { type: "agreed"; priceCents: number; listPriceCents: number }
  | { type: "no_deal"; reason: string }
  | { type: "invoice"; invoiceId: string; url: string | null; email: string }
  | { type: "error"; message: string };

const Move = z.object({
  action: z.enum(["offer", "accept", "walk_away"]).describe("offer a price, accept the other side's last price, or walk away"),
  priceUsd: z.number().describe("Your offer in US dollars, e.g. 1.75 (ignored for accept/walk_away)"),
  message: z
    .string()
    .describe("One or two short sentences to the other side, in a professional tone. If you make an offer, quote exactly priceUsd."),
});
type MoveT = z.infer<typeof Move>;

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

type Turn = { side: Side; action: MoveT["action"]; priceCents: number; message: string };

function historyText(history: Turn[]) {
  if (history.length === 0) return "No offers yet. You open.";
  return history
    .map((t) => `${t.side === "buyer" ? "Buyer" : "Publisher"}: ${t.action}${t.action === "offer" ? ` ${usd(t.priceCents)}` : ""}: "${t.message}"`)
    .join("\n");
}

async function decide(system: string, prompt: string): Promise<MoveT> {
  return withModelFallback(AGENT_MODELS, async (model) => {
    const { output } = await generateText({ model, output: Output.object({ schema: Move }), system, prompt, temperature: 0.4, maxRetries: 1 });
    return output;
  });
}

export async function runNegotiation(opts: { agentId: string; budgetCents: number; emit: (e: NegotiationEvent) => void }) {
  const { emit } = opts;
  const agent = await prisma.agent.findUniqueOrThrow({ where: { id: opts.agentId } });
  const resources = await prisma.resource.findMany({ where: { priceTrainCents: { gt: 0 } }, include: { publisher: true } });
  if (resources.length === 0) throw new Error("No paid articles to license.");
  const publisher = resources[0].publisher;

  const listPriceCents = resources.reduce((s, r) => s + r.priceTrainCents, 0);
  const floorCents = Math.ceil((listPriceCents * DEAL_POLICY.floorPct) / 100);
  const buyerEmail = await payerEmailForAgent(agent.id);
  if (!buyerEmail) throw new Error("The buyer agent has no saved PayPal account to invoice. Top up once with “Save my PayPal” ticked.");

  const deal = await prisma.deal.create({
    data: {
      agentId: agent.id,
      publisherId: publisher.id,
      resourceIds: resources.map((r) => r.id),
      listPriceCents,
      budgetCents: opts.budgetCents,
      floorCents,
      buyerEmail,
    },
  });
  emit({ type: "setup", dealId: deal.id, articles: resources.length, listPriceCents, budgetCents: opts.budgetCents, buyer: agent.name, publisher: publisher.name });

  const catalog = resources
    .map((r) => `- ${r.title} (AI value ${r.valueScore ?? "?"}/100, list training price ${usd(r.priceTrainCents)})`)
    .join("\n");

  const buyerSystem = `You negotiate for ${agent.name}, an AI lab buying a license to use a publisher's articles as AI training data.
Your PRIVATE maximum budget is ${usd(opts.budgetCents)}. Never offer or accept more than that. The publisher does not know it.
Get a fair deal: open well below list, move up in reasonable steps, and accept when the price is good value. Walk away only if
agreement within your budget is clearly impossible.`;

  const publisherSystem = `You negotiate for ${publisher.name}, a publisher licensing its articles to AI labs for model training.
Your PRIVATE floor is ${usd(floorCents)} (${DEAL_POLICY.floorPct}% of list). Never offer or accept less than that. The buyer does not know it.
Defend the value of original reporting and data, concede in small steps, and close a deal when the offer is reasonable.`;

  const history: Turn[] = [];
  let buyerBest = 0; // highest the buyer has offered
  let publisherAsk = listPriceCents; // lowest the publisher has asked

  const finish = async (priceCents: number) => {
    await prisma.deal.update({
      where: { id: deal.id },
      data: { agreedPriceCents: priceCents, transcript: history as unknown as object },
    });
    emit({ type: "agreed", priceCents, listPriceCents });
    const invoice = await invoiceDeal(deal.id);
    emit({ type: "invoice", invoiceId: invoice.invoiceId, url: invoice.url, email: buyerEmail });
  };

  for (let round = 1; round <= DEAL_POLICY.maxRounds; round++) {
    for (const side of ["buyer", "publisher"] as Side[]) {
      const isBuyer = side === "buyer";
      const lastOther = isBuyer ? publisherAsk : buyerBest;
      const prompt = `Package: training license for ${resources.length} articles. List price ${usd(listPriceCents)}.
${catalog}

Round ${round} of ${DEAL_POLICY.maxRounds}. ${round === DEAL_POLICY.maxRounds ? "This is the final round." : ""}
Negotiation so far:
${historyText(history)}`;

      const move = await decide(isBuyer ? buyerSystem : publisherSystem, prompt);
      let action = move.action;
      // Models reason in dollars; money is handled in cents. A value far above
      // list was almost certainly given in cents already.
      let price = move.priceUsd > (listPriceCents / 100) * 5 ? Math.round(move.priceUsd) : Math.round(move.priceUsd * 100);
      let guard: string | undefined;

      // Code-enforced limits. The models propose; these rules decide.
      if (action === "accept") {
        price = lastOther;
        if (history.length === 0) {
          action = "offer";
          price = isBuyer ? Math.round(listPriceCents * 0.5) : listPriceCents;
        } else if (isBuyer && price > opts.budgetCents) {
          action = "offer";
          price = Math.max(buyerBest, opts.budgetCents);
          guard = `Can't accept ${usd(lastOther)}: above the buyer's budget. Turned into an offer at the budget.`;
        } else if (!isBuyer && price < floorCents) {
          action = "offer";
          price = Math.min(publisherAsk, floorCents);
          guard = `Can't accept ${usd(lastOther)}: below the publisher's floor. Turned into a counter at the floor.`;
        }
      }
      if (action === "offer") {
        if (isBuyer) {
          const clamped = Math.min(Math.max(price, buyerBest), opts.budgetCents);
          if (clamped !== price) guard = `Offer adjusted to ${usd(clamped)} (never above budget, never below its last offer).`;
          price = clamped;
          buyerBest = price;
        } else {
          const clamped = Math.max(Math.min(price, publisherAsk), floorCents);
          if (clamped !== price) guard = `Counter adjusted to ${usd(clamped)} (never below floor, never above its last ask).`;
          price = clamped;
          publisherAsk = price;
        }
      }

      const turn: Turn = { side, action, priceCents: action === "walk_away" ? 0 : price, message: move.message };
      history.push(turn);
      emit({ type: "turn", side, round, action, priceCents: turn.priceCents, message: move.message, guard });

      if (action === "accept") return finish(price);
      if (action === "walk_away") {
        await prisma.deal.update({ where: { id: deal.id }, data: { status: "NO_DEAL", transcript: history as unknown as object } });
        return emit({ type: "no_deal", reason: `${isBuyer ? "The buyer" : "The publisher"} walked away.` });
      }
      // Offers that cross mean agreement at the earlier standing price.
      if (buyerBest > 0 && buyerBest >= publisherAsk) return finish(isBuyer ? publisherAsk : buyerBest);
    }
  }

  await prisma.deal.update({ where: { id: deal.id }, data: { status: "NO_DEAL", transcript: history as unknown as object } });
  emit({ type: "no_deal", reason: `No agreement after ${DEAL_POLICY.maxRounds} rounds (buyer ${usd(buyerBest)}, publisher ${usd(publisherAsk)}).` });
}
