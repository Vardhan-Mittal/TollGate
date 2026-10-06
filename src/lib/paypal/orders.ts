import "server-only";
import { paypalRequest } from "./client";

type Amount = { currency_code: string; value: string };

export type PayPalOrder = {
  id: string;
  status: "CREATED" | "SAVED" | "APPROVED" | "VOIDED" | "COMPLETED" | "PAYER_ACTION_REQUIRED";
  payment_source?: {
    paypal?: {
      email_address?: string;
      attributes?: { vault?: { id?: string; status?: string; customer?: { id?: string } } };
    };
  };
  purchase_units?: {
    custom_id?: string;
    payments?: { captures?: { id: string; status: string; amount: Amount; custom_id?: string }[] };
  }[];
};

export function centsToValue(cents: number) {
  return (cents / 100).toFixed(2);
}

export function valueToCents(value: string) {
  return Math.round(Number(value) * 100);
}

export async function createWalletOrder(opts: {
  topUpId: string;
  agentId: string;
  amountCents: number;
  origin: string;
  saveForAutoRecharge: boolean;
  customerId?: string | null;
}) {
  const vault = opts.saveForAutoRecharge
    ? {
        vault: { store_in_vault: "ON_SUCCESS", usage_type: "MERCHANT", customer_type: "CONSUMER" },
        ...(opts.customerId ? { customer: { id: opts.customerId } } : {}),
      }
    : undefined;

  return paypalRequest<PayPalOrder>("/v2/checkout/orders", {
    method: "POST",
    requestId: `order-${opts.topUpId}`,
    body: {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: opts.agentId,
          custom_id: opts.topUpId,
          description: "Tollgate agent wallet top-up",
          amount: { currency_code: "USD", value: centsToValue(opts.amountCents) },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "Tollgate",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: `${opts.origin}/wallet?paypal=return`,
            cancel_url: `${opts.origin}/wallet?paypal=cancel`,
          },
          ...(vault ? { attributes: vault } : {}),
        },
      },
    },
  });
}

/** Charges a saved PayPal account with no buyer present (merchant-initiated). */
export async function chargeVaultedPayPal(opts: { topUpId: string; agentId: string; amountCents: number; vaultId: string }) {
  return paypalRequest<PayPalOrder>("/v2/checkout/orders", {
    method: "POST",
    requestId: `auto-${opts.topUpId}`,
    body: {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: opts.agentId,
          custom_id: opts.topUpId,
          description: "Tollgate agent wallet auto-recharge",
          amount: { currency_code: "USD", value: centsToValue(opts.amountCents) },
        },
      ],
      payment_source: { paypal: { vault_id: opts.vaultId } },
    },
  });
}

export async function captureOrder(orderId: string) {
  return paypalRequest<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    requestId: `capture-${orderId}`,
  });
}

export function firstCapture(order: PayPalOrder) {
  return order.purchase_units?.[0]?.payments?.captures?.[0];
}
