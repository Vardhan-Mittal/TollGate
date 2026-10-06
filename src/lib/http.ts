import "server-only";
import { NextResponse } from "next/server";
import { PayPalError } from "@/lib/paypal/client";
import { TollgateError } from "@/lib/tollgate/service";

/** Turns known errors into JSON responses; rethrows anything unexpected. */
export function errorResponse(err: unknown) {
  if (err instanceof TollgateError) return NextResponse.json(err.toJSON(), { status: err.status });
  if (err instanceof PayPalError) {
    console.error("PayPal error", { status: err.status, name: err.name, message: err.message, debugId: err.debugId });
    return NextResponse.json(
      { error: "paypal_error", message: err.message, paypal_name: err.name, debug_id: err.debugId },
      { status: 502 },
    );
  }
  throw err;
}
