import "server-only";

// Minimal PayPal REST client: OAuth token caching, JSON in/out, idempotency
// via PayPal-Request-Id, and errors that keep PayPal's debug_id for support.

const BASE = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";

// A hung PayPal call must not hold a request (or a page render) open forever.
const TIMEOUT_MS = 10_000;

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

// Loose on purpose: the same body is a success payload or one of PayPal's error shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PayPalBody = Record<string, any>;

/** PayPal error bodies are usually JSON, but a gateway 5xx can be HTML or plain text. */
async function readBody(res: Response): Promise<PayPalBody> {
  // The timeout also covers reading the body.
  const text = await res.text().catch(() => {
    throw new PayPalError(504, "PAYPAL_TIMEOUT", "PayPal's response was cut off");
  });
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    if (res.ok) throw new PayPalError(res.status, "INVALID_RESPONSE", "PayPal returned a response that isn't JSON");
    return { message: `${res.status} ${res.statusText}: ${text.slice(0, 200)}`.trim() };
  }
}

/** fetch with the timeout; a timeout or network failure becomes a PayPalError (status 504/502). */
async function paypalFetch(url: string, init: RequestInit) {
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new PayPalError(
      timedOut ? 504 : 502,
      timedOut ? "PAYPAL_TIMEOUT" : "PAYPAL_UNREACHABLE",
      timedOut ? `PayPal did not answer within ${TIMEOUT_MS / 1000}s` : "Could not reach PayPal",
    );
  }
}

export async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set");

  const res = await paypalFetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await readBody(res);
  if (!res.ok) throw new PayPalError(res.status, data.error ?? "AUTH_FAILED", data.error_description ?? data.message ?? "PayPal auth failed");

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
  const res = await paypalFetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(opts.requestId ? { "PayPal-Request-Id": opts.requestId } : {}),
      ...opts.headers,
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });

  const data = await readBody(res);
  if (!res.ok) {
    const detail = data.details?.[0];
    const message = detail ? `${detail.issue}: ${detail.description ?? ""}`.trim() : (data.message ?? res.statusText);
    throw new PayPalError(res.status, data.name ?? "PAYPAL_ERROR", message, data.debug_id, data.details);
  }
  return data as T;
}
