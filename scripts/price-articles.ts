// Runs the AI pricing engine over every article and prints the results.
// Usage: npm run ai:price
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { prisma } = await import("../src/lib/db");
  const { priceResource } = await import("../src/lib/ai/pricing");

  const resources = await prisma.resource.findMany({ orderBy: { publishedAt: "desc" } });
  for (const r of resources) {
    let result;
    try {
      result = await priceResource(r.id);
    } catch (err) {
      console.log(`
${r.title}
  FAILED: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    const price = result.isFree ? "free" : `read ${result.readPriceCents}¢ · train ${result.trainPriceCents}¢`;
    console.log(`\n${r.title}\n  value ${result.valueScore}/100 → ${price}\n  ${result.reasoning}\n  teaser: ${result.teaser}`);
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
