import { consumeRateLimit } from "../../../lib/rate-limit";
import { clientIp, isAllowedOrigin } from "../../../lib/security";
import { authenticatedUserId } from "../../_shared/auth";
import { paypalApi, paypalPlan, PAYPAL_PLANS, type PayPalPlanId } from "../../_shared/paypal";
import type { FunctionContext } from "../../_shared/types";

type OrderBody = { plan?: unknown };
type PayPalOrder = { id?: string; status?: string };

export async function onRequestPost({ request, env }: FunctionContext) {
  if (!isAllowedOrigin(request, env)) return paymentError("INVALID_REQUEST", 403);
  if (!env.DB) return paymentError("NOT_CONFIGURED", 503);
  const userId = await authenticatedUserId(request, env);
  if (!userId) return paymentError("AUTH_REQUIRED", 401);

  const rate = consumeRateLimit(`paypal-order:${userId}:${clientIp(request)}`, 10, 15 * 60 * 1000);
  if (!rate.allowed) return paymentError("RATE_LIMITED", 429);

  let body: OrderBody;
  try {
    body = (await request.json()) as OrderBody;
  } catch {
    return paymentError("INVALID_REQUEST", 400);
  }
  const plan = paypalPlan(body.plan);
  if (!plan || typeof body.plan !== "string") return paymentError("INVALID_PLAN", 400);
  const planId = body.plan as PayPalPlanId;
  const internalId = crypto.randomUUID();

  const response = await paypalApi(env, "/v2/checkout/orders", {
    method: "POST",
    headers: { "PayPal-Request-Id": internalId },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: internalId,
        custom_id: userId,
        description: `Cutline ${plan.name} — ${plan.credits} image credits for 30 days`,
        amount: { currency_code: "USD", value: plan.amount },
      }],
    }),
  });
  if (!response?.ok) return paymentError("PAYPAL_UNAVAILABLE", 502);
  const order = (await response.json()) as PayPalOrder;
  if (!order.id) return paymentError("PAYPAL_UNAVAILABLE", 502);

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO paypal_orders
     (id, paypal_order_id, user_id, plan, amount, currency, credits, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'USD', ?, ?, ?)`,
  ).bind(internalId, order.id, userId, planId, PAYPAL_PLANS[planId].amount, plan.credits, order.status ?? "CREATED", now).run();

  return Response.json({ orderId: order.id }, { headers: { "Cache-Control": "no-store" } });
}

function paymentError(code: string, status: number) {
  return Response.json({ error: { code } }, { status, headers: { "Cache-Control": "no-store" } });
}
