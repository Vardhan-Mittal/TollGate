import "server-only";
import { paypalRequest } from "./client";

const SIGNATURE_HEADERS = [
  "paypal-auth-algo",
  "paypal-cert-url",
  "paypal-transmission-id",
  "paypal-transmission-sig",
  "paypal-transmission-time",
] as const;

/** Asks PayPal to confirm the webhook really came from PayPal and was meant for our webhook id. */
export async function verifyWebhook(headers: Headers, event: unknown): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    console.error("PAYPAL_WEBHOOK_ID is not set; rejecting webhook");
    return false;
  }

  const values = SIGNATURE_HEADERS.map((name) => headers.get(name));
  if (values.some((v) => !v)) return false;
  const [authAlgo, certUrl, transmissionId, transmissionSig, transmissionTime] = values as string[];

  const result = await paypalRequest<{ verification_status: "SUCCESS" | "FAILURE" }>(
    "/v1/notifications/verify-webhook-signature",
    {
      method: "POST",
      body: {
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: event,
      },
    },
  );
  return result.verification_status === "SUCCESS";
}
