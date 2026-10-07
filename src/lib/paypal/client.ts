import "server-only";

// Minimal PayPal REST client: OAuth token caching, JSON in/out, idempotency
// via PayPal-Request-Id, and errors that keep PayPal's debug_id for support.

const BASE = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";

let cachedToken: { value: string; expiresAt: number } | null = null;

export class PayPalError extends Error {
  constructor(
    public status: number,
    public name: string,
    message: string,
    public debugId?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set");

  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new PayPalError(res.status, data.error ?? "AUTH_FAILED", data.error_description ?? "PayPal auth failed");

  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

export async function paypalRequest<T>(
  path: string,
  opts: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    requestId?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(opts.requestId ? { "PayPal-Request-Id": opts.requestId } : {}),
      ...opts.headers,
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    cache: "no-store",
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const detail = data.details?.[0];
    const message = detail ? `${detail.issue}: ${detail.description ?? ""}`.trim() : (data.message ?? res.statusText);
    throw new PayPalError(res.status, data.name ?? "PAYPAL_ERROR", message, data.debug_id, data.details);
  }
  return data as T;
}
