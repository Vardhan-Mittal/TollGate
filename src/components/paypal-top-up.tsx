"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ui } from "@/components/ui/kit";
import type { PayPalOneTimeSession, PayPalSdkInstance } from "@/types/paypal-sdk";

const SDK_URL = process.env.NEXT_PUBLIC_PAYPAL_SDK_URL ?? "https://www.sandbox.paypal.com/web-sdk/v6/core";
const AMOUNTS = [500, 1000, 2500];
const CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

let sdkPromise: Promise<PayPalSdkInstance> | null = null;

function loadSdk(clientId: string) {
  sdkPromise ??= new Promise<PayPalSdkInstance>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => {
      if (!window.paypal) return reject(new Error("PayPal SDK did not load"));
      window.paypal
        .createInstance({ clientId, components: ["paypal-payments"], pageType: "checkout" })
        .then(resolve, reject);
    };
    script.onerror = () => reject(new Error("Could not load the PayPal SDK"));
    document.head.appendChild(script);
  }).catch((err) => {
    sdkPromise = null; // allow a retry on the next mount
    throw err;
  });
  return sdkPromise;
}

type Status = { kind: "idle" | "working" | "done" | "error"; message?: string };

export function PayPalTopUp({ agentId, hasSavedPayPal }: { agentId: string; hasSavedPayPal: boolean }) {
  const router = useRouter();
  const [amountCents, setAmountCents] = useState(1000);
  const [save, setSave] = useState(!hasSavedPayPal);
  const [sdk, setSdk] = useState<PayPalSdkInstance | null>(null);
  const [status, setStatus] = useState<Status>(
    CLIENT_ID ? { kind: "idle" } : { kind: "error", message: "NEXT_PUBLIC_PAYPAL_CLIENT_ID is not set." },
  );
  const sessionRef = useRef<PayPalOneTimeSession | null>(null);

  useEffect(() => {
    if (!CLIENT_ID) return;
    loadSdk(CLIENT_ID).then(setSdk, (err: Error) => setStatus({ kind: "error", message: err.message }));
  }, []);

  // A payment session is tied to the "save PayPal" choice, so rebuild it when that changes.
  useEffect(() => {
    if (!sdk) return;
    const session = sdk.createPayPalOneTimePaymentSession({
      savePayment: save,
      async onApprove({ orderId }) {
        setStatus({ kind: "working", message: "Confirming payment with PayPal…" });
        try {
          const res = await fetch(`/api/wallet/orders/${orderId}/capture`, { method: "POST" });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            setStatus({ kind: "error", message: body.message ?? "Capture failed." });
            return;
          }
          setStatus({ kind: "done", message: body.credited === false ? "Already credited." : "Wallet topped up." });
        } catch {
          setStatus({
            kind: "error",
            message: "Couldn't confirm the payment. If PayPal charged you, the webhook will still credit the wallet.",
          });
        } finally {
          router.refresh();
        }
      },
      onCancel() {
        setStatus({ kind: "idle", message: "Payment cancelled." });
      },
      onError(err) {
        setStatus({ kind: "error", message: err.message || "PayPal reported an error." });
      },
    });
    sessionRef.current = session;
    return () => session.destroy?.();
  }, [sdk, save, router]);

  async function createOrder() {
    const res = await fetch("/api/wallet/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, amountCents, save }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message ?? "Could not create the PayPal order.");
    return { orderId: body.orderId as string };
  }

  function pay() {
    const session = sessionRef.current;
    if (!session) return;
    setStatus({ kind: "working", message: "Waiting for PayPal…" });
    // start() must run inside the click handler so the popup isn't blocked.
    session.start({ presentationMode: "auto" }, createOrder()).catch((err: Error) => {
      setStatus({ kind: "error", message: err.message });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Top-up amount">
        {AMOUNTS.map((cents) => (
          <button
            key={cents}
            type="button"
            onClick={() => setAmountCents(cents)}
            aria-pressed={amountCents === cents}
            className={`rounded-full border px-4 py-1.5 font-mono text-sm tabular-nums transition-colors ${
              amountCents === cents
                ? ui.chipActive
                : "border-zinc-200 text-zinc-700 hover:border-zinc-300 dark:border-white/10 dark:text-zinc-300 dark:hover:border-white/20"
            }`}
          >
            ${cents / 100}
          </button>
        ))}
      </div>

      <label className={`flex items-start gap-2.5 text-sm ${ui.muted}`}>
        <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} className="mt-1 accent-emerald-600" />
        <span>
          Save my PayPal for auto-recharge
          <span className="mt-0.5 block text-xs text-pretty text-zinc-500">Lets Tollgate refill this wallet when it runs low, within the limits you set.</span>
        </span>
      </label>

      <div className="max-w-xs" onClick={pay}>
        {sdk ? (
          <paypal-button type="pay" class="paypal-gold"></paypal-button>
        ) : (
          <div className="h-11 animate-pulse rounded-full bg-zinc-200 dark:bg-white/[0.06]" />
        )}
      </div>

      {status.message && (
        <p
          role="status"
          className={`text-sm ${
            status.kind === "error"
              ? "text-red-600 dark:text-red-400"
              : status.kind === "done"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-zinc-500"
          }`}
        >
          {status.message}
        </p>
      )}
    </div>
  );
}
