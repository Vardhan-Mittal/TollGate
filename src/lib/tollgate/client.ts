// A small Tollgate client, the way any outside agent would speak the protocol:
// plain HTTP, a 402 quote, a pay call, and a retry with the access token.
import type { LicenseType, PayResponse, QuoteResponse } from "./protocol";

export type FetchResult =
  | { kind: "content"; title: string; body: string; license: string }
  | { kind: "quote"; quote: QuoteResponse }
  | { kind: "error"; status: number; message: string };

export class TollgateClient {
  constructor(
    private opts: { origin: string; agentKey: string; userAgent: string },
  ) {}

  private headers(extra: Record<string, string> = {}) {
    return { "User-Agent": this.opts.userAgent, "Tollgate-Agent": this.opts.userAgent, Accept: "application/json", ...extra };
  }

  async catalog() {
    const res = await fetch(`${this.opts.origin}/api/tollgate/catalog`, { headers: this.headers(), cache: "no-store" });
    return (await res.json()) as {
      publisher: string | null;
      items: { path: string; title: string; description: string; published_at: string }[];
    };
  }

  /** Requests a page. Free pages come back as content; paid pages as a quote. */
  async open(path: string, license: LicenseType = "read"): Promise<FetchResult> {
    const res = await fetch(`${this.opts.origin}${path}`, {
      headers: this.headers({ "Tollgate-License": license }),
      cache: "no-store",
    });
    const body = await res.json().catch(() => null);
    if (res.status === 402 && body?.quote_id) return { kind: "quote", quote: body as QuoteResponse };
    if (res.ok && body?.body) return { kind: "content", title: body.title, body: body.body, license: body.license };
    return { kind: "error", status: res.status, message: body?.message ?? res.statusText };
  }

  async pay(quoteId: string): Promise<{ ok: true; receipt: PayResponse } | { ok: false; status: number; error: string; message: string }> {
    const res = await fetch(`${this.opts.origin}/api/tollgate/pay`, {
      method: "POST",
      headers: this.headers({ Authorization: `Bearer ${this.opts.agentKey}`, "Content-Type": "application/json" }),
      body: JSON.stringify({ quote_id: quoteId }),
      cache: "no-store",
    });
    const body = await res.json();
    return res.ok ? { ok: true, receipt: body } : { ok: false, status: res.status, error: body.error, message: body.message };
  }

  /** Reads a paid page with its access token. */
  async read(path: string, accessToken: string): Promise<FetchResult> {
    const res = await fetch(`${this.opts.origin}${path}`, {
      headers: this.headers({ Authorization: `Tollgate ${accessToken}` }),
      cache: "no-store",
    });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.body) return { kind: "content", title: body.title, body: body.body, license: body.license };
    return { kind: "error", status: res.status, message: body?.message ?? res.statusText };
  }
}
