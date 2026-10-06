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
| AI pricing + AI research agent | ⏳ week 3 |

## Run it locally

Requirements: Node.js 20+, a Postgres database (e.g. [Neon](https://neon.tech) free tier).

```bash
npm install
cp .env.example .env.local   # then fill in the values
npx prisma migrate deploy
npm run db:seed              # demo publisher, 6 articles, demo agent wallet ($5)
npm run dev
```

Pages: `/blog` (demo publisher), `/wallet` (fund agents with PayPal), `/dashboard` (publisher earnings and cash-out).

Then, in a second terminal, watch a bot hit the paywall, pay and read:

```bash
npm run demo:agent
npm run demo:agent -- quillbrook-delays-sodium-ion-plant train
```

Or by hand:

```bash
curl -i -A "GPTBot" http://localhost:3000/blog/q3-2026-battery-cell-price-survey
```

## PayPal webhooks (deployed only)

PayPal delivers webhooks to public HTTPS URLs, so after deploying:

```bash
npm run webhook:register -- https://your-app.example.com
```

Put the printed id in `PAYPAL_WEBHOOK_ID`. Locally, top-ups are credited from the capture response instead.

## Tech

Next.js 16 · TypeScript · Prisma 7 + Postgres · jose (signed access tokens) ·
PayPal REST APIs (sandbox) · Vercel AI SDK

## License

[MIT](LICENSE)
