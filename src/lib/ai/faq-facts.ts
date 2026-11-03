// Shared by the landing FAQ (accordion copy) and /api/faq (the facts Gemini may
// answer from, plus the keyword fallback). Every line here is checked against the
// README and the code it names; keep it that way when editing.

export type FaqItem = { id: string; question: string; answer: string; keywords: string[] };

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "real-money",
    question: "Is this real money?",
    answer:
      "No. Every PayPal flow in the demo (wallet top-ups, auto-recharge, publisher payouts and invoices) runs on the PayPal sandbox, so only test money moves. The 402 gate, ledger and pricing are real code pointed at sandbox accounts.",
    keywords: ["real", "money", "sandbox", "test", "fake", "live", "production", "charged", "cost"],
  },
  {
    id: "cooperate",
    question: "Do AI bots have to cooperate?",
    answer:
      "Partly. The gate charges clients that identify as AI: known crawler user-agents such as GPTBot, or a Tollgate-Agent header. Claiming to be a bot gets a 402, not free content, but a bot posing as an ordinary browser reads free like a human. A production deployment would verify agents with Web Bot Auth (signed requests), crawler IP ranges and behavioural detection.",
    keywords: ["bot", "bots", "cooperate", "crawler", "user", "agent", "spoof", "pretend", "browser", "bypass", "detect", "identify", "verify", "gptbot"],
  },
  {
    id: "paypal",
    question: "Why PayPal and not crypto?",
    answer:
      "Publishers and agent owners already have PayPal, so nobody needs a crypto wallet or a new CDN. Agents spend from a prepaid, PayPal-funded wallet, so a 1–25¢ read is a ledger debit rather than a card charge with a fee larger than the price. Saved PayPal (Vault) refills the wallet, Payouts pays publishers, and Invoicing settles bulk licences.",
    keywords: ["paypal", "crypto", "blockchain", "stablecoin", "usdc", "card", "fees", "fee", "wallet", "why", "vault"],
  },
  {
    id: "compare",
    question: "How is this different from Cloudflare pay-per-crawl or x402?",
    answer:
      "Same core idea: machines pay for what they read, signalled with HTTP 402. Tollgate focuses on what sits around that payment: a PayPal-settled wallet that refills itself, AI pricing on the publisher's side, a buyer agent that decides with a stated reason whether a quote is worth paying, and agent-to-agent licence deals settled by PayPal invoice.",
    keywords: ["cloudflare", "x402", "tollbit", "different", "difference", "compare", "competitor", "alternative", "pay", "per", "crawl", "unique"],
  },
  {
    id: "runaway",
    question: "What stops a runaway agent?",
    answer:
      "The Spend Guardian scores every payment against that agent's own history: repeat buys of one article, purchase velocity, spend bursts, price outliers and unusual hours. From 40% risk a payment is flagged; from 75% it is held and the wallet frozen, with no payments or auto-recharge until the owner reviews it. Gemini writes the owner a short note, and payments are checked one at a time per agent, so a burst can't slip past.",
    keywords: ["runaway", "loop", "stop", "guardian", "fraud", "risk", "freeze", "frozen", "leaked", "key", "safe", "safety", "overspend", "limit", "budget"],
  },
  {
    id: "ai-vs-code",
    question: "What does the AI decide, and what does code decide?",
    answer:
      "AI proposes, code enforces. Gemini scores articles and suggests prices, but code clamps every read price to 1–25¢. The buyer agent picks pay or skip, but code holds its hard budget, never pays a quote twice and never lets the wallet go below zero. Negotiating agents can't cross their budget or floor, and the finance assistant needs a human yes before money moves.",
    keywords: ["ai", "decide", "decides", "code", "enforce", "control", "gemini", "model", "llm", "hallucinate", "trust", "price", "pricing", "human"],
  },
  {
    id: "publishers-paid",
    question: "How do publishers get paid?",
    answer:
      "Each paid read credits the publisher's balance, net of a 10% platform fee. Once the balance reaches $1, the publisher cashes it out to PayPal through the Payouts API in one batch instead of a card fee per read. Bulk training licences agreed between agents are billed by PayPal invoice.",
    keywords: ["publisher", "publishers", "paid", "payout", "payouts", "cash", "earnings", "revenue", "fee", "invoice", "license", "licence", "withdraw", "money"],
  },
];

/** Compact, verified facts the /api/faq model is allowed to answer from. */
export const TOLLGATE_FACTS = `
Tollgate: an HTTP 402 paywall for AI crawlers and agents, settled on PayPal. Humans read free; AI agents get a price quote, pay from a PayPal-funded wallet and receive a short-lived access token. Built for the "Build What's Next with PayPal and AI" hackathon. One fictional demo publisher (a blog); publisher sign-up is out of scope.
Flow: agent requests an article -> 402 Payment Required with quote_id, price, teaser, pay_url -> agent POSTs /api/tollgate/pay with its agent key -> gets access_token, charged amount, balance -> re-requests the article with "Authorization: Tollgate <token>". Discovery document: /.well-known/tollgate.json.
Why: AI systems crawl heavily and send few readers back (Cloudflare, July 2025: about 1,091 crawls per referral for OpenAI and about 38,000 for Anthropic, versus 14:1 for Google Search). Tollgate lets publishers charge the machines.
Pages: /live (agent and publisher side by side; also "Simulate runaway agent"), /deals (agent-to-agent licence negotiation), /dashboard (earnings, AI pricing grid, cash-out, finance assistant), /wallet (fund agents with PayPal), /blog (demo publisher), /agent (research agent on its own).
Wallets: an agent owner tops up with the PayPal button. When the balance drops below the owner's threshold, saved PayPal (Vault) recharges it automatically with no human present (never while the Spend Guardian has the wallet frozen). A payment the balance can't cover, or one over the agent's daily budget, is refused with a 402 error and nothing is charged; wallets never go below zero.
PayPal: Orders v2 + JS SDK v6 for wallet top-ups, Vault for auto-recharge with no buyer present, Payouts for publisher cash-out (minimum $1), Agent Toolkit for invoicing, webhooks. Everything runs on the PayPal sandbox; no real money moves.
${FAQ_ITEMS.map((f) => `${f.question} ${f.answer}`).join("\n")}
AI features (Gemini via the Vercel AI SDK, with automatic model fallback): pricing engine (scores freshness, originality, depth, scarcity; sets read and training prices, a teaser and a reason); research agent (reads 402 quotes, pays or skips with a reason, answers with citations; a page bought in the last 10 minutes is re-read on the same licence, never bought twice); negotiating agents (bulk training licence, private limits, crossing offers close the deal, invoice created by code); Spend Guardian notes; finance assistant (earnings questions, PayPal invoices, Payouts; money-moving actions need an explicit human yes).
Scalability: quotes are signed, expiring tokens, so unpaid 402s write nothing to the database; a quote can be paid only once; wallet debits are conditional (balance >= price) so no overdraft; access tokens are verified in memory; bot visits are logged in batches. Measured on one instance: 2,000 bot requests at 100 concurrent, about 300 requests/s, p95 519 ms.
Public demo: no sign-in or sign-up needed, anyone can try every page; guardrails: payouts only to the demo publisher's sandbox account; invoices only to example.com addresses; AI endpoints and price edits are rate-limited.
Tech: Next.js 16, TypeScript, Prisma 7 + Postgres, jose, PayPal REST APIs, PayPal JS SDK v6, PayPal Agent Toolkit, Vercel AI SDK + Google Gemini. MIT licence.
`.trim();
