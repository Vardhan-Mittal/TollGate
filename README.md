# Tollgate

**AI agents pay the web they read.** Tollgate is an HTTP 402 paywall for AI
crawlers and agents, settled on PayPal. Humans read for free; AI agents get a
price quote, pay from a PayPal-funded wallet, and receive a short-lived access
token.

> 🚧 Built for the *Build What's Next with PayPal and AI* hackathon. Work in
> progress — see [PLAN.md](PLAN.md) for the roadmap.

## How it works

```
Agent ── GET /blog/article ─────────────▶ proxy: AI bot, no token
      ◀─ 402 Payment Required { quote_id, price, teaser, pay_url }
Agent ── POST /api/tollgate/pay { quote_id } (Bearer agent key)
      ◀─ 200 { access_token, charged, balance }
Agent ── GET /blog/article (Authorization: Tollgate <token>)
      ◀─ 200 content
```

Discovery document: `/.well-known/tollgate.json`

## Status

| Piece | State |
|---|---|
| 402 gate, quotes, wallet debits, access tokens, ledger | ✅ working |
| Demo publisher (fictional blog) | ✅ working |
| PayPal wallet top-up (Orders v2 + JS SDK v6), webhooks | ✅ working (tested end to end in sandbox) |
| Auto-recharge from saved PayPal (Vault) | ✅ working (merchant-initiated charge, no buyer present) |
| Publisher cash-out (Payouts API) | ✅ working |
| AI pricing engine (seller side) | ✅ working |
| AI research agent with pay/skip decisions (buyer side) | ✅ working |
| Publisher finance assistant (PayPal Agent Toolkit) | ✅ working |
| AI traffic & revenue grid (AG Grid) | ✅ working |
| Live split-screen of agent and publisher (`/live`) | ✅ working |
| Editable AI pricing grid with publisher overrides (AG Grid) | ✅ working |
| Agent-to-agent license negotiation settled by PayPal invoice (`/deals`) | ✅ working |
| Public demo guardrails, Render blueprint | ✅ ready |

## Run it locally

Requirements: Node.js 20+, a Postgres database (e.g. [Neon](https://neon.tech) free tier).

```bash
npm install
cp .env.example .env.local   # then fill in the values
npx prisma migrate deploy
npm run db:seed              # demo publisher, 6 articles, demo agent wallet ($5)
npm run dev
```

Pages: `/blog` (demo publisher), `/agent` (AI research agent console), `/wallet` (fund agents with PayPal), `/dashboard` (earnings, AI pricing, cash-out, finance assistant).

To (re)price every article with AI: `npm run ai:price`.

Then, in a second terminal, watch a bot hit the paywall, pay and read:

```bash
npm run demo:agent
npm run demo:agent -- quillbrook-delays-sodium-ion-plant train
```

Or by hand:

```bash
curl -i -A "GPTBot" http://localhost:3000/blog/q3-2026-battery-cell-price-survey
```

## Where AI is used

| Feature | What the AI does | Guardrails in code |
|---|---|---|
| **Pricing engine** (`src/lib/ai/pricing.ts`) | Scores freshness, originality, depth and scarcity; sets read/train prices, a teaser and a plain-English reason | Prices clamped to publisher limits; scores normalised |
| **Research agent** (`src/lib/ai/research-agent.ts`) | Browses the catalog, reads 402 quotes, decides pay or skip with a reason, answers with citations | Hard budget cap; each quote paid at most once; wallet never below zero |
| **Negotiating agents** (`src/lib/ai/negotiation.ts`) | A buyer agent and the publisher's agent bargain over a bulk training license, each with private limits | Buyer can never exceed its budget, publisher never goes below its floor; crossing offers close the deal; the invoice is created by code via the PayPal Agent Toolkit |
| **Finance assistant** (`src/lib/ai/finance-copilot.ts`) | Answers earnings questions, drafts and sends PayPal invoices (PayPal Agent Toolkit), cashes out via Payouts | Money-moving or sending actions need an explicit human "yes" |

Models: Gemini via the Vercel AI SDK, with automatic fallback when a model is overloaded (`src/lib/ai/models.ts`).

## Deploy on Render

1. In [Render](https://render.com), choose **New + > Blueprint** and select this repository. Render reads [`render.yaml`](render.yaml).
2. Fill in the secret values when prompted (same values as `.env.local`; `TOLLGATE_TOKEN_SECRET` is generated for you).
3. After the first deploy, register the PayPal webhook and add the printed id as `PAYPAL_WEBHOOK_ID`:
   ```bash
   npm run webhook:register -- https://<your-service>.onrender.com
   ```
4. During judging, switch the service to a paid instance (or keep it warm) so it never sleeps.

## Testing instructions for judges

Everything runs on the **PayPal sandbox**: no real money moves.

| Try this | Where |
|---|---|
| See the buyer agent and the publisher side by side | `/live` → **Run research agent** |
| Watch two AI agents negotiate a training license | `/deals` → **Start negotiation** → pay the PayPal invoice with the sandbox buyer |
| Watch an AI agent read 402 quotes and pay or skip | `/agent` → pick a preset → **Run research agent** |
| See AI pricing, traffic (AG Grid), payouts, finance assistant | `/dashboard` |
| Top up an agent wallet with PayPal | `/wallet` → **PayPal** button → log in with the sandbox buyer below |
| Hit the paywall yourself | `curl -i -A "GPTBot" <site>/blog/q3-2026-battery-cell-price-survey` |

Sandbox buyer login (fake money only): provided in the Devpost submission's testing instructions.

Public-demo guardrails (`DEMO_MODE=true`): payouts always go to the demo publisher's sandbox account, invoices only to `example.com` addresses, AI endpoints are rate-limited, and the shared saved PayPal account cannot be removed.

## PayPal webhooks (deployed only)

PayPal delivers webhooks to public HTTPS URLs, so after deploying:

```bash
npm run webhook:register -- https://your-app.example.com
```

Put the printed id in `PAYPAL_WEBHOOK_ID`. Locally, top-ups are credited from the capture response instead.

## Tech

Next.js 16 · TypeScript · Prisma 7 + Postgres · jose (signed access tokens) ·
PayPal REST APIs (sandbox) · PayPal JS SDK v6 · PayPal Agent Toolkit · Vercel AI SDK + Google Gemini

## License

[MIT](LICENSE)
