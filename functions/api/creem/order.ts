import { authenticatedUserId } from "../../_shared/auth";
import type { FunctionContext } from "../../_shared/types";

export async function onRequestGet({ request, env }: FunctionContext) {
  if (!env.DB) return Response.json({ error: { code: "NOT_CONFIGURED" } }, { status: 503 });
  const userId = await authenticatedUserId(request, env);
  if (!userId) return Response.json({ error: { code: "AUTH_REQUIRED" } }, { status: 401 });
  const checkoutId = new URL(request.url).searchParams.get("checkout_id");
  if (!checkoutId) return Response.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 });
  const order = await env.DB.prepare(
    `SELECT checkout_id AS orderId, plan, amount_cents AS amountCents, currency, credits, status,
            captured_at AS capturedAt, valid_until AS validUntil
     FROM creem_orders WHERE checkout_id = ? AND user_id = ?`,
  ).bind(checkoutId, userId).first();
  return order
    ? Response.json({ order }, { headers: { "Cache-Control": "no-store" } })
    : Response.json({ error: { code: "ORDER_NOT_FOUND" } }, { status: 404 });
}
