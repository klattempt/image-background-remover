import type { FunctionContext } from "../../_shared/types";

export async function onRequestGet({ env }: FunctionContext) {
  const configured = Boolean(
    env.CREEM_API_KEY
    && env.CREEM_WEBHOOK_SECRET
    && env.CREEM_PLUS_PRODUCT_ID
    && env.CREEM_PRO_PRODUCT_ID,
  );
  return Response.json({
    configured,
    environment: env.CREEM_ENVIRONMENT === "live" ? "live" : "test",
  }, { headers: { "Cache-Control": "no-store" } });
}
