import type { FunctionContext } from "../../_shared/types";

export async function onRequestGet({ env }: FunctionContext) {
  if (!env.PAYPAL_CLIENT_ID) {
    return Response.json({ error: { code: "NOT_CONFIGURED" } }, { status: 503 });
  }
  return Response.json({
    clientId: env.PAYPAL_CLIENT_ID,
    currency: "USD",
    environment: env.PAYPAL_ENVIRONMENT === "live" ? "live" : "sandbox",
  }, { headers: { "Cache-Control": "no-store" } });
}
