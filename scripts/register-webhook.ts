// Registers Tollgate's webhook with PayPal and prints the webhook id to put in
// PAYPAL_WEBHOOK_ID. PayPal only delivers to public HTTPS URLs, so run this
// against the deployed app.
// Usage: npm run webhook:register -- https://your-app.onrender.com
import { config } from "dotenv";

config({ path: ".env.local" });

const EVENTS = [
  "PAYMENT.CAPTURE.COMPLETED",
  "PAYMENT.PAYOUTSBATCH.SUCCESS",
  "PAYMENT.PAYOUTSBATCH.DENIED",
  "PAYMENT.PAYOUTSBATCH.PROCESSING",
  "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
  "PAYMENT.PAYOUTS-ITEM.FAILED",
  "PAYMENT.PAYOUTS-ITEM.RETURNED",
  "PAYMENT.PAYOUTS-ITEM.BLOCKED",
  "PAYMENT.PAYOUTS-ITEM.UNCLAIMED",
];

async function main() {
  const origin = process.argv[2];
  if (!origin?.startsWith("https://")) throw new Error("Pass the deployed https:// origin, e.g. https://tollgate.onrender.com");

  const base = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";
  const basic = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const { access_token } = await tokenRes.json();

  const res = await fetch(`${base}/v1/notifications/webhooks`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url: `${origin.replace(/\/$/, "")}/api/paypal/webhook`,
      event_types: EVENTS.map((name) => ({ name })),
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    console.error("PayPal refused the webhook:", body);
    process.exit(1);
  }
  console.log(`Webhook created. Set this in your environment:\nPAYPAL_WEBHOOK_ID=${body.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
