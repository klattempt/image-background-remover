import { authenticatedUserId } from "../../_shared/auth";
import type { FunctionContext } from "../../_shared/types";

export async function onRequestGet({ request, env }: FunctionContext) {
  if (!env.DB) return Response.json({ error: { code: "NOT_CONFIGURED" } }, { status: 503 });
  const userId = await authenticatedUserId(request, env);
  if (!userId) return Response.json({ error: { code: "AUTH_REQUIRED" } }, { status: 401 });
  const orderId = new URL(request.url).searchParams.get("order_id");
  if (!orderId) return Response.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 });
  const order = await env.DB.prepare(
    `SELECT paypal_order_id AS orderId, plan, amount, currency, credits, status,
            captured_at AS capturedAt, valid_until AS validUntil
     FROM paypal_orders WHERE paypal_order_id = ? AND user_id = ?`,
  ).bind(orderId, userId).first();
  return order
    ? Response.json({ order }, { headers: { "Cache-Control": "no-store" } })
    : Response.json({ error: { code: "ORDER_NOT_FOUND" } }, { status: 404 });
}
