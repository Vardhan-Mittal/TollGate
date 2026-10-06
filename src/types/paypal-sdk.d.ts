// Minimal typings for the parts of PayPal JavaScript SDK v6 that Tollgate uses.
import type { DetailedHTMLProps, HTMLAttributes } from "react";

export type PayPalOneTimeSession = {
  start(options: { presentationMode: "auto" | "popup" | "modal" | "redirect" }, order: Promise<{ orderId: string }>): Promise<void>;
  destroy?(): void;
};

export type PayPalSdkInstance = {
  createPayPalOneTimePaymentSession(options: {
    onApprove: (data: { orderId: string; payerId?: string }) => Promise<void> | void;
    onCancel?: (data: unknown) => void;
    onError?: (error: Error) => void;
    savePayment?: boolean;
  }): PayPalOneTimeSession;
};

declare global {
  interface Window {
    paypal?: {
      createInstance(options: {
        clientId?: string;
        clientToken?: string;
        components?: string[];
        pageType?: string;
        locale?: string;
      }): Promise<PayPalSdkInstance>;
    };
  }
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "paypal-button": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        type?: "pay" | "checkout" | "buynow" | "subscribe";
        class?: string;
        disabled?: boolean;
      };
    }
  }
}
