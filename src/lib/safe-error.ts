import "server-only";
import { PayPalError } from "@/lib/paypal/client";
import { TollgateError } from "@/lib/tollgate/service";

/**
 * Text that is safe to show a browser or an LLM. Known errors carry messages
 * written for users; anything else (Prisma, network) may leak internals such as
 * the database host, so callers log it and send `fallback` instead.
 */
export function publicErrorMessage(err: unknown, fallback: string) {
  return err instanceof TollgateError || err instanceof PayPalError ? err.message : fallback;
}
