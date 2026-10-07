"use server";

import { refresh } from "next/cache";
import { priceResource } from "@/lib/ai/pricing";
import { prisma } from "@/lib/db";
import { DEMO_PUBLISHER_ID } from "@/lib/publisher";

export async function repriceAll() {
  const resources = await prisma.resource.findMany({ where: { publisherId: DEMO_PUBLISHER_ID } });
  // Sequential keeps us inside the Gemini free-tier rate limits.
  for (const r of resources) {
    try {
      await priceResource(r.id);
    } catch (err) {
      console.error("repricing failed", r.path, err);
    }
  }
  refresh();
}
