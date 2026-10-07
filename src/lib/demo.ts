import "server-only";

// Public-demo guardrails. With DEMO_MODE on (the default), judges and visitors
// can use every flow, but cannot send payouts or invoices to arbitrary people
// or remove the saved PayPal account that powers auto-recharge.
export const DEMO_MODE = process.env.DEMO_MODE !== "false";

/** In demo mode every cash-out goes to this sandbox account, whatever is typed. */
export const DEMO_PAYOUT_EMAIL = process.env.DEMO_PAYOUT_EMAIL?.trim() || null;

/** In demo mode invoices may only go to reserved example domains (RFC 2606). */
export function isAllowedInvoiceRecipient(email: string) {
  if (!DEMO_MODE) return true;
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return domain === "example.com" || domain.endsWith(".example") || domain.endsWith(".example.com");
}
