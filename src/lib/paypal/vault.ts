import "server-only";
import { PayPalError, paypalRequest } from "./client";

/** Deletes a saved PayPal payment token. Already-deleted tokens count as success. */
export async function deletePaymentToken(vaultId: string) {
  try {
    await paypalRequest(`/v3/vault/payment-tokens/${encodeURIComponent(vaultId)}`, { method: "DELETE" });
  } catch (err) {
    if (err instanceof PayPalError && err.status === 404) return;
    throw err;
  }
}
