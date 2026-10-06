// Walks one article through the full Tollgate loop as a bot would:
//   GET page -> 402 quote -> POST pay -> GET page with token -> content.
// Usage: npm run demo:agent -- [slug] [read|train]
import { config } from "dotenv";

config({ path: ".env.local" });

const BASE = process.env.TOLLGATE_BASE_URL ?? "http://localhost:3000";
const KEY = process.env.DEMO_AGENT_KEY;
// Accepts "/blog/slug" or just "slug" (Git Bash on Windows mangles leading-slash args).
const arg = process.argv[2] ?? "q3-2026-battery-cell-price-survey";
const path = arg.includes("/blog/") ? arg.slice(arg.indexOf("/blog/")) : `/blog/${arg}`;
const license = process.argv[3] === "train" ? "train" : "read";
const botHeaders = { "User-Agent": "Mozilla/5.0 (compatible; ResearchBot/1.0)", "Tollgate-Agent": "ResearchBot/1.0" };

async function main() {
  if (!KEY) throw new Error("DEMO_AGENT_KEY missing — run `npx prisma db seed` first.");

  console.log(`\n1) GET ${path} as a bot (${license} license)`);
  const first = await fetch(BASE + path, { headers: { ...botHeaders, "Tollgate-License": license } });
  console.log(`   <- ${first.status} ${first.statusText}`);
  const quote = await first.json();
  if (first.status !== 402) return console.log("   ", quote);
  console.log(`   quote ${quote.quote_id}: $${quote.price.value} — "${quote.teaser}"`);

  console.log("\n2) POST /api/tollgate/pay");
  const pay = await fetch(quote.pay_url, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ quote_id: quote.quote_id }),
  });
  const receipt = await pay.json();
  console.log(`   <- ${pay.status}`, pay.ok ? `charged $${receipt.charged.value}, balance now $${receipt.balance.value}` : receipt);
  if (!pay.ok) return;

  console.log(`\n3) GET ${path} with the access token`);
  const second = await fetch(BASE + path, {
    headers: { ...botHeaders, Authorization: `Tollgate ${receipt.access_token}`, Accept: "application/json" },
  });
  const content = await second.json();
  console.log(`   <- ${second.status}: "${content.title}" (${content.body?.length ?? 0} chars, license ${content.license})`);

  console.log("\n4) Paying the same quote twice is refused");
  const replay = await fetch(quote.pay_url, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ quote_id: quote.quote_id }),
  });
  console.log(`   <- ${replay.status}`, (await replay.json()).error);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
