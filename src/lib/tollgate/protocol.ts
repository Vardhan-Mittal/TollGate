// Tollgate protocol v0 — shared constants and wire types.

export const TOLLGATE_VERSION = "0";

export const HEADERS = {
  version: "Tollgate-Version",
  agent: "Tollgate-Agent",
  license: "Tollgate-License",
  quote: "Tollgate-Quote",
  price: "Tollgate-Price",
} as const;

/** Set by the proxy when it rewrites a gated page to an internal route. */
export const GATE_PATH_HEADER = "x-tollgate-path";
export const GATE_REASON_HEADER = "x-tollgate-reason";

export const QUOTE_TTL_SECONDS = 5 * 60;
export const ACCESS_TOKEN_TTL_SECONDS = 10 * 60;
export const PLATFORM_FEE_BPS = 1000; // 10%

export type LicenseType = "read" | "train";

export type Money = { value: string; currency: "USD" };

export type QuoteResponse = {
  error: "payment_required";
  quote_id: string;
  resource: string;
  title: string;
  license: LicenseType;
  price: Money;
  teaser: string;
  pay_url: string;
  expires_at: string;
  reason?: "token_invalid" | "token_expired";
};

export type PayResponse = {
  access_token: string;
  token_type: "Tollgate";
  expires_in: number;
  resource: string;
  license: LicenseType;
  charged: Money;
  balance: Money;
};

export type ApiError = {
  error: string;
  message: string;
  [extra: string]: unknown;
};

export function parseLicense(value: string | null | undefined): LicenseType {
  return value?.toLowerCase() === "train" ? "train" : "read";
}

export function toDbLicense(license: LicenseType) {
  return license === "train" ? "TRAIN" : "READ";
}

export function fromDbLicense(license: "READ" | "TRAIN"): LicenseType {
  return license === "TRAIN" ? "train" : "read";
}
