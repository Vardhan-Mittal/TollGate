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

export function readTollgateToken(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (!auth) return null;
  const [scheme, value] = auth.split(" ");
  return scheme?.toLowerCase() === "tollgate" && value ? value : null;
}
