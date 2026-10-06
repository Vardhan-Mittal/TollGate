import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_TOKEN_TTL_SECONDS, QUOTE_TTL_SECONDS, TOLLGATE_VERSION } from "@/lib/tollgate/protocol";

// Discovery document so agents can learn how to pay this site.
export function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  return NextResponse.json({
    tollgate_version: TOLLGATE_VERSION,
    currency: "USD",
    licenses: ["read", "train"],
    gated_paths: ["/blog/*"],
    pay_url: `${origin}/api/tollgate/pay`,
    balance_url: `${origin}/api/tollgate/balance`,
    topup_url: `${origin}/wallet`,
    quote_ttl_seconds: QUOTE_TTL_SECONDS,
    access_token_ttl_seconds: ACCESS_TOKEN_TTL_SECONDS,
    payment_rails: ["paypal"],
    how_to: [
      "Identify yourself with a known AI user-agent or a Tollgate-Agent header.",
      "A gated page answers 402 with a quote_id and price.",
      "POST { quote_id } to pay_url with Authorization: Bearer <agent API key>.",
      "Retry the page with Authorization: Tollgate <access_token>. Send Accept: application/json for clean text.",
    ],
  });
}
