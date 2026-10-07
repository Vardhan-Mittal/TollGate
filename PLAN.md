# Tollgate — Build Plan

> **AI agents pay the web they read.** A PayPal-powered HTTP 402 paywall that lets
> creators charge AI crawlers and agents per use, with AI-driven pricing on the
> seller side and AI budget reasoning on the buyer side.

- **Hackathon:** Build What's Next with PayPal and AI (Devpost)
- **Deadline:** **Nov 12, 2026, 12:00 PM PST** — we submit on **Nov 10**
- **Prize targets:** Overall (or Best Use of Agentic Commerce) + one sponsor prize: **AG Grid** (dashboard tables) and/or **Render** (hosting). KERNEL has no prize in the official rules, so it is optional.

---

## 1. The problem

AI crawlers and agents read the web at massive scale. Publishers, bloggers and
small API owners pay the hosting bill, lose the human traffic, and earn nothing.
Today they can only **block** bots (robots.txt) or sign one-off licensing deals
that only big publishers can get. There is no simple way for a small creator to
say: *"AI, you can read this — for 5 cents."*

## 2. The solution

Tollgate is a drop-in gate for any website:

1. **Detect** — a proxy layer spots AI agents (known crawler user-agents + a
   `Tollgate-Agent` header) and lets humans through for free.
2. **Quote** — bots get `HTTP 402 Payment Required` with a machine-readable
   quote: price, license type (read / quote / train), an AI-written teaser,
   and where to pay.
3. **Decide** — the buyer agent's AI reads the teaser, compares value vs. its
   budget, and decides whether to pay.
4. **Pay** — the agent pays from a prepaid Tollgate wallet funded with
   **PayPal**; it gets a short-lived signed access token.
5. **Access** — the agent retries with the token and gets the content.
6. **Settle** — publishers cash out earnings through **PayPal Payouts**;
   enterprise AI companies can instead get a monthly **PayPal Invoice**.

**Positioning:** Cloudflare's pay-per-crawl only works on Cloudflare; Coinbase's
x402 requires crypto. Tollgate is **open, framework-agnostic, and runs on PayPal
rails** — money everyone already has.

## 3. Where PayPal is used (must be central)

| Feature | PayPal capability |
|---|---|
| Agent operator funds the wallet | **Orders v2** (intent `CAPTURE`) + **JS SDK v6** buttons |
| Auto-recharge when the agent's balance is low (no human present) | **Vault** (save PayPal as a payment method) + merchant-initiated **Orders** |
| Confirm money actually arrived | **Webhooks** (`PAYMENT.CAPTURE.COMPLETED`), signature-verified |
| Publisher cash-out | **Payouts API** (batch payout, platform fee kept) |
| Enterprise AI customers billed monthly | **Invoicing API** |
| Publisher "finance copilot" chat ("pay me out", "invoice AcmeAI for October") | **PayPal Agent Toolkit** (`@paypal/agent-toolkit/ai-sdk`) |

> Why a prepaid wallet: card/PayPal fees make 2–5 cent payments impossible one
> by one. We aggregate: one PayPal top-up → many micro-debits on our ledger →
> one batched payout. Explain this in the README and video — judges will ask.

## 4. Where AI is used (must be meaningful)

1. **Seller-side pricing engine** — when content is published (or first hit),
   an LLM scores it: freshness, originality, depth, proprietary data, demand.
   Outputs price per license type + a short teaser + reasoning shown on the
   dashboard. Publisher sets floor/ceiling; code clamps the AI's number.
2. **Buyer-side research agent** — given a task and a budget ("Research
   EV battery prices, max $0.50"), it browses, hits 402s, reads teasers,
   **decides** pay vs. skip with a stated reason, pays, and cites paid sources
   in its final answer. Runs in a **KERNEL** cloud browser for real-site
   browsing (optional — KERNEL is not a prize category).
3. **Publisher finance copilot** — chat over PayPal Agent Toolkit tools.
4. *(Stretch)* **Bot-behavior detection** — flag crawlers that fake a human
   user-agent from request patterns.

**Guardrails in code, not the prompt:** per-request price cap, per-agent daily
budget, wallet can never go negative, idempotent payments, full audit ledger.

## 5. The Tollgate protocol (v0)

```http
GET /blog/ev-battery-prices-2026
User-Agent: ResearchBot/1.0
Tollgate-Agent: agt_123

HTTP/1.1 402 Payment Required
Content-Type: application/json
Tollgate-Version: 0

{
  "quote_id": "qt_9f2...",
  "resource": "/blog/ev-battery-prices-2026",
  "license": "read",
  "price": { "value": "0.05", "currency": "USD" },
  "teaser": "Original survey of 40 battery suppliers with Q3 2026 price data...",
  "pay_url": "https://tollgate.app/api/tollgate/pay",
  "expires_at": "2026-10-20T12:00:00Z"
}
```

```http
POST /api/tollgate/pay
Authorization: Bearer <agent_api_key>
{ "quote_id": "qt_9f2..." }

200 OK
{ "access_token": "<JWT scoped to resource + license, 10 min>", "balance": "4.95" }
```

```http
GET /blog/ev-battery-prices-2026
Authorization: Tollgate <access_token>

200 OK  (content)
```

## 6. Architecture

```
tollgate/                       Next.js (App Router, TypeScript)
├─ src/proxy.ts                 bot detection → verify token (jose, edge) → 402
├─ src/app/
│  ├─ blog/[slug]/              demo publisher site (protected)
│  ├─ dashboard/                publisher: earnings, AI pricing, bots seen, payouts, copilot
│  ├─ agent/                    buyer: live agent console (task, budget, decision log)
│  ├─ wallet/                   agent operator: PayPal top-up, auto-recharge, ledger
│  └─ api/
│     ├─ tollgate/quote|pay     protocol endpoints
│     ├─ paypal/orders|capture|webhook|payouts|vault
│     └─ agent/run              streams the buyer agent's steps
├─ src/lib/
│  ├─ tollgate/                 protocol types, token signing, bot detection
│  ├─ paypal/                   REST client (OAuth token cache), webhook verify
│  ├─ ai/pricing.ts             seller-side pricing
│  ├─ ai/agent.ts               buyer-side agent (Vercel AI SDK tool calling)
│  └─ ledger.ts                 double-entry ledger in Postgres
└─ prisma/schema.prisma
```

- **AI:** Vercel AI SDK (provider-agnostic; Gemini or Claude via env var)
- **DB:** Postgres (Neon free tier) + Prisma
- **Hosting:** Render (sponsor) — one web service
- **UI:** Tailwind + shadcn/ui

### Data model
`Publisher` · `Resource` (price, license prices, teaser, aiReasoning) ·
`Agent` (apiKey hash, dailyBudget, vaultId) · `Quote` · `AccessGrant` ·
`LedgerEntry` (debit/credit, idempotency key) · `TopUp` (PayPal order id) ·
`Payout` (PayPal batch id, status) · `WebhookEvent`

## 7. Timeline (5 weeks)

### Week 1 — Oct 7–13: Foundation + protocol
- [x] PayPal Developer account; sandbox **business** (platform) + 2 **personal** accounts (agent operator, publisher); app Client ID/Secret
- [x] LLM API key (Gemini), Neon Postgres (KERNEL account optional)
- [x] Public GitHub repo, MIT license, commit daily
- [x] Prisma schema + ledger
- [x] Demo blog with 5–6 articles of different value (news, original data, evergreen, fluff)
- [x] Proxy (`src/proxy.ts`, Next 16's renamed middleware): bot detection + 402 quote + token verification
- [x] `/api/tollgate/pay` with a seeded wallet (no PayPal yet) → full loop works with `curl`

### Week 2 — Oct 14–20: PayPal money in & out
- [x] PayPal REST client with token caching
- [x] Wallet top-up: Orders v2 + JS SDK button → capture → credit ledger
- [x] Webhook endpoint + signature verification; ledger credited only once (idempotent)
- [x] Publisher cash-out with Payouts API (minus 10% platform fee)
- [x] **Test Vault early** (enable in sandbox app settings). If blocked → fallback: low-balance alert + one-click top-up
- [ ] Invoicing: monthly invoice for an "enterprise" agent

### Week 3 — Oct 21–27: AI
- [x] Pricing engine with structured output (zod) + floor/ceiling clamp
- [x] Buyer agent: tools `fetch_url`, `pay_quote`, `get_balance`; budget reasoning; final answer with paid citations
- [x] Stream agent steps to the `/agent` console (decision cards: PAID / SKIPPED + why)
- [ ] KERNEL browser tool for browsing real pages
- [x] Publisher copilot with `@paypal/agent-toolkit/ai-sdk`

### Week 4 — Oct 28–Nov 3: Product polish
- [ ] Dashboard: earnings over time, top paying bots, per-article AI price + reasoning, payout history
- [ ] Wallet page: balance, ledger, auto-recharge settings
- [ ] Landing page explaining the protocol in 10 seconds
- [ ] `npm`-style snippet: "add Tollgate to your Next.js / Express site in 3 lines"
- [ ] *(Stretch)* expose Tollgate as an **MCP tool** so any MCP agent (e.g. Claude) can pay gates
- [ ] *(Stretch)* bot-behavior detection

### Week 5 — Nov 4–11: Ship
- [ ] Deploy to Render with sandbox keys; seed demo data
- [ ] README: problem, demo link, architecture diagram, **PayPal APIs used**, **AI + sponsor tools used**, setup, sandbox test logins for judges
- [ ] Demo video (< 3 min, no copyrighted music) — script below
- [ ] Submit on Devpost **Nov 10** (2-day buffer)

## 8. Demo video script (≤ 3:00)

| Time | Scene |
|---|---|
| 0:00–0:20 | Problem: "AI read 10,000 pages of this blog last month. The author earned $0." |
| 0:20–0:45 | Publisher installs Tollgate; AI prices each article (show reasoning) |
| 0:45–1:45 | Agent task: "Research EV battery prices, budget $0.30." Hits 402 → reads teaser → **pays** for original data, **skips** fluff with a reason → answer with paid citations |
| 1:45–2:15 | Wallet low → PayPal auto-recharge; ledger updates |
| 2:15–2:40 | Publisher dashboard → "Cash out" → PayPal Payout lands in sandbox account |
| 2:40–3:00 | Architecture + "open protocol on PayPal rails" + what's next |

## 9. MVP vs. stretch

- **Must have:** 402 loop · PayPal top-up · Payouts · AI pricing · buyer agent with pay/skip decisions · dashboard · deployed · video
- **Nice to have:** Vault auto-recharge · Invoicing · Agent Toolkit copilot · KERNEL · MCP tool · behavior detection

## 10. Risks

| Risk | Mitigation |
|---|---|
| Payouts / Vault not enabled in sandbox | Test both in week 2; fallbacks noted above |
| LLM output inconsistent | Structured output, low temperature, code-enforced clamps |
| Proxy can't do slow DB work | Proxy only verifies JWT + calls internal quote API |
| Demo flakiness | Seeded data, fixed demo task, record video from a stable build |
| Scope creep | Finish the MVP list before touching stretch items |
