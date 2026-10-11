import { SignJWT, jwtVerify, errors } from "jose";
import { ACCESS_TOKEN_TTL_SECONDS, type LicenseType } from "./protocol";

const AUDIENCE = "tollgate";

function secret() {
  const value = process.env.TOLLGATE_TOKEN_SECRET;
  if (!value || value.length < 32) throw new Error("TOLLGATE_TOKEN_SECRET must be at least 32 characters");
  return new TextEncoder().encode(value);
}

export type AccessClaims = {
  resource: string;
  license: LicenseType;
  grantId: string;
  agentId: string;
};

export async function signAccessToken(claims: AccessClaims) {
  return new SignJWT({ lic: claims.license, gid: claims.grantId, agt: claims.agentId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.resource)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret());
}

export type VerifyResult =
  | { ok: true; claims: AccessClaims }
  | { ok: false; reason: "token_invalid" | "token_expired" };

/** Verifies a token and checks it was issued for this exact resource. */
export async function verifyAccessToken(token: string, resource: string): Promise<VerifyResult> {
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: AUDIENCE, algorithms: ["HS256"] });
    if (payload.sub !== resource) return { ok: false, reason: "token_invalid" };
    return {
      ok: true,
      claims: {
        resource: payload.sub,
        license: payload.lic === "train" ? "train" : "read",
        grantId: String(payload.gid),
        agentId: String(payload.agt),
      },
    };
  } catch (err) {
    if (err instanceof errors.JWTExpired) return { ok: false, reason: "token_expired" };
    return { ok: false, reason: "token_invalid" };
  }
}

// Quotes are signed tokens rather than database rows, so answering a crawler
// with a 402 costs no database write. A separate audience means a quote can
// never be replayed as an access token.
const QUOTE_AUDIENCE = "tollgate-quote";

export type QuoteClaims = {
  quoteId: string;
  resourceId: string;
  resource: string;
  license: LicenseType;
  priceCents: number;
  botName?: string;
};

export async function signQuoteToken(claims: QuoteClaims, ttlSeconds: number) {
  return new SignJWT({ rid: claims.resourceId, lic: claims.license, prc: claims.priceCents, bot: claims.botName })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(claims.quoteId)
    .setSubject(claims.resource)
    .setAudience(QUOTE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secret());
}

export type QuoteVerifyResult =
  | { ok: true; claims: QuoteClaims; expiresAt: Date }
  | { ok: false; reason: "quote_invalid" | "quote_expired" };

export async function verifyQuoteToken(token: string): Promise<QuoteVerifyResult> {
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: QUOTE_AUDIENCE, algorithms: ["HS256"] });
    if (!payload.jti || !payload.sub || typeof payload.prc !== "number" || typeof payload.rid !== "string") {
      return { ok: false, reason: "quote_invalid" };
    }
    return {
      ok: true,
      expiresAt: new Date((payload.exp ?? 0) * 1000),
      claims: {
        quoteId: payload.jti,
        resourceId: payload.rid,
        resource: payload.sub,
        license: payload.lic === "train" ? "train" : "read",
        priceCents: payload.prc,
        botName: typeof payload.bot === "string" ? payload.bot : undefined,
      },
    };
  } catch (err) {
    if (err instanceof errors.JWTExpired) return { ok: false, reason: "quote_expired" };
    return { ok: false, reason: "quote_invalid" };
  }
}

export function readTollgateToken(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (!auth) return null;
  const [scheme, value] = auth.split(" ");
  return scheme?.toLowerCase() === "tollgate" && value ? value : null;
}
