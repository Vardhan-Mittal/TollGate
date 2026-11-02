"use server";

import { z } from "zod";
import { limitAction } from "@/lib/action-limit";
import { PRICE_LIMITS } from "@/lib/ai/pricing";
import { prisma } from "@/lib/db";
import { DEMO_MODE } from "@/lib/demo";
import { DEMO_PUBLISHER_ID } from "@/lib/publisher";
import { invalidateResourceCache } from "@/lib/tollgate/resource-cache";

export type PriceRowUpdate = { readCents: number; trainCents: number; overridden: boolean };
type Result = { ok: true; row: PriceRowUpdate } | { ok: false; error: string };

// The public dashboard has no sign-in: keep every article paid so the demo flows keep working.
const MIN_CENTS = DEMO_MODE ? 1 : 0;
const limitPriceEdits = () => limitAction("price-edit", 30, 10 * 60_000);

const Input = z.object({
  resourceId: z.string().min(1),
  field: z.enum(["read", "train"]),
  cents: z.number().int(),
});

/** Publisher overrides one price by hand. Limits are enforced here, not in the grid. */
export async function setPrice(input: z.infer<typeof Input>): Promise<Result> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a whole number of cents." };
  const { resourceId, field, cents } = parsed.data;

  const max = field === "read" ? PRICE_LIMITS.readMaxCents : PRICE_LIMITS.trainMaxCents;
  if (cents < MIN_CENTS || cents > max) {
    const label = field === "read" ? "Read" : "Train";
    return { ok: false, error: DEMO_MODE ? `${label} price must be 1–${max}¢ in the public demo.` : `${label} price must be 0–${max}¢ (0 = free).` };
  }
  const limited = await limitPriceEdits();
  if (limited) return { ok: false, error: limited };

  const resource = await prisma.resource.findFirst({ where: { id: resourceId, publisherId: DEMO_PUBLISHER_ID } });
  if (!resource) return { ok: false, error: "Article not found." };

  const updated = await prisma.resource.update({
    where: { id: resourceId },
    data: { [field === "read" ? "priceReadCents" : "priceTrainCents"]: cents, priceOverridden: true },
  });
  invalidateResourceCache();
  return { ok: true, row: { readCents: updated.priceReadCents, trainCents: updated.priceTrainCents, overridden: true } };
}

/** Hands pricing back to the AI's latest suggestion. */
export async function resetToAiPrice(resourceId: string): Promise<Result> {
  const limited = await limitPriceEdits();
  if (limited) return { ok: false, error: limited };
  const resource = await prisma.resource.findFirst({ where: { id: resourceId, publisherId: DEMO_PUBLISHER_ID } });
  if (!resource) return { ok: false, error: "Article not found." };
  if (resource.aiPriceReadCents == null || resource.aiPriceTrainCents == null) {
    return { ok: false, error: "No AI price yet. Run “Re-price all with AI” first." };
  }

  const updated = await prisma.resource.update({
    where: { id: resourceId },
    data: { priceReadCents: resource.aiPriceReadCents, priceTrainCents: resource.aiPriceTrainCents, priceOverridden: false },
  });
  invalidateResourceCache();
  return { ok: true, row: { readCents: updated.priceReadCents, trainCents: updated.priceTrainCents, overridden: false } };
}
