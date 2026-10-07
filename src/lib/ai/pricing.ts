import { generateText, Output } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { PRICING_MODELS, withModelFallback } from "./models";

// Publisher guardrails. The AI proposes, code enforces: prices are always
// clamped into these bounds no matter what the model returns.
export const PRICE_LIMITS = {
  readMinCents: 1,
  readMaxCents: 25,
  trainMaxCents: 200,
};

const Appraisal = z.object({
  scores: z.object({
    freshness: z.number().describe("How new and time-sensitive the information is, scored 1-10"),
    originality: z.number().describe("Original reporting, interviews or data vs. rewritten common knowledge, scored 1-10"),
    depth: z.number().describe("How detailed and substantive the content is, scored 1-10"),
    scarcity: z.number().describe("How hard it is to find this information elsewhere, scored 1-10"),
  }),
  valueScore: z.number().describe("Overall value of this content to an AI agent, from 0 to 100"),
  isFree: z.boolean().describe("True only for pages about the publication itself (about, methodology, policies)"),
  readPriceCents: z.number().describe("Price in US cents for an agent to read and cite this once"),
  trainPriceCents: z.number().describe("Price in US cents to use this content as AI training data"),
  teaser: z.string().describe("One or two sentences an AI agent sees before paying. Describe what it contains without giving away the key facts or numbers."),
  reasoning: z.string().describe("Two or three plain-English sentences explaining the price to the publisher"),
});

export type AppraisalResult = z.infer<typeof Appraisal> & { model: string };

const SYSTEM = `You price articles for Tollgate, a marketplace where AI agents pay publishers per use of their content.

Pricing guidance:
- Read price (one-time read and citation): ${PRICE_LIMITS.readMinCents}–${PRICE_LIMITS.readMaxCents} cents.
  Generic tips and widely available explainers sit at the bottom; fresh news is mid-range;
  original surveys, proprietary data and exclusive interviews sit at the top.
- Training price (content used to train a model) is usually 2–8x the read price. Use a high multiple for
  original data and exclusive material, a low multiple for commodity content. Maximum ${PRICE_LIMITS.trainMaxCents} cents.
- News loses value as it ages; evergreen explainers keep a steady but low price.
- Pages about the publication itself (about, methodology, corrections policy) should be free.

The teaser must help an agent judge relevance without leaking the valuable specifics (no exact numbers or names of findings).`;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(n)));
}

export async function appraise(input: { title: string; body: string; publishedAt: Date }): Promise<AppraisalResult> {
  const ageDays = Math.max(0, Math.round((Date.now() - input.publishedAt.getTime()) / 86_400_000));

  const { output, modelId } = await withModelFallback(PRICING_MODELS, async (model, modelId) => {
    const result = await generateText({
      model,
      output: Output.object({ schema: Appraisal }),
      system: SYSTEM,
      prompt: `Title: ${input.title}\nPublished: ${ageDays} days ago\n\n${input.body}`,
      temperature: 0.2,
      maxRetries: 1,
    });
    return { output: result.output, modelId };
  });

  // Smaller models sometimes ignore ranges; normalise rather than fail.
  const scores = {
    freshness: clamp(output.scores.freshness, 1, 10),
    originality: clamp(output.scores.originality, 1, 10),
    depth: clamp(output.scores.depth, 1, 10),
    scarcity: clamp(output.scores.scarcity, 1, 10),
  };
  const base = { ...output, scores, valueScore: clamp(output.valueScore, 0, 100), model: modelId };

  if (output.isFree) {
    return { ...base, readPriceCents: 0, trainPriceCents: 0 };
  }
  const read = clamp(output.readPriceCents, PRICE_LIMITS.readMinCents, PRICE_LIMITS.readMaxCents);
  const train = clamp(output.trainPriceCents, read, PRICE_LIMITS.trainMaxCents);
  return { ...base, readPriceCents: read, trainPriceCents: train };
}

/** Appraises one stored article and saves the AI's price, teaser and reasoning. */
export async function priceResource(resourceId: string) {
  const resource = await prisma.resource.findUniqueOrThrow({ where: { id: resourceId } });
  const result = await appraise(resource);
  const { freshness, originality, depth, scarcity } = result.scores;

  await prisma.resource.update({
    where: { id: resourceId },
    data: {
      priceReadCents: result.readPriceCents,
      priceTrainCents: result.trainPriceCents,
      teaser: result.teaser,
      valueScore: result.valueScore,
      aiReasoning: `${result.reasoning} (freshness ${freshness}/10, originality ${originality}/10, depth ${depth}/10, scarcity ${scarcity}/10 · ${result.model})`,
    },
  });
  return result;
}
