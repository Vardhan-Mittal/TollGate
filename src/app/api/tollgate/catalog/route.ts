import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Free table of contents for agents: what exists, not what it says.
// Prices are deliberately left out; agents learn them from the 402 quote.
export async function GET() {
  const resources = await prisma.resource.findMany({
    orderBy: { publishedAt: "desc" },
    include: { publisher: true },
  });

  return NextResponse.json({
    publisher: resources[0]?.publisher.name ?? null,
    items: resources.map((r) => ({
      path: r.path,
      title: r.title,
      description: r.description,
      published_at: r.publishedAt.toISOString(),
    })),
  });
}
