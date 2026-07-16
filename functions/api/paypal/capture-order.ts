import { isAllowedOrigin } from "../../../lib/security";
import { authenticatedUserId } from "../../_shared/auth";
import { paypalApi } from "../../_shared/paypal";
import type { FunctionContext } from "../../_shared/types";

type CaptureBody = { orderId?: unknown };
type OrderRow = { amount: string; currency: string; status: string };
type PayPalCapture = {
  status?: string;
  payer?: { email_address?: string };
  purchase_units?: Array<{ payments?: { captures?: Array<{ amount?: { currency_code?: string; value?: string } }> } }>;
};

export async function onRequestPost({ request, env }: FunctionContext) {
  if (!isAllowedOrigin(request, env)) return paymentError("INVALID_REQUEST", 403);
  if (!env.DB) return paymentError("NOT_CONFIGURED", 503);
  const userId = await authenticatedUserId(request, env);
  if (!userId) return paymentError("AUTH_REQUIRED", 401);

  let body: CaptureBody;
  try {
    body = (await request.json()) as CaptureBody;
  } catch {
    return paymentError("INVALID_REQUEST", 400);
  }
  if (typeof body.orderId !== "string" || !/^[A-Z0-9]{8,32}$/u.test(body.orderId)) {
    return paymentError("INVALID_REQUEST", 400);
  }

  const order = await env.DB.prepare(
    "SELECT amount, currency, status FROM paypal_orders WHERE paypal_order_id = ? AND user_id = ?",
  ).bind(body.orderId, userId).first<OrderRow>();
  if (!order) return paymentError("ORDER_NOT_FOUND", 404);

  let response = await paypalApi(env, `/v2/checkout/orders/${encodeURIComponent(body.orderId)}/capture`, {
    method: "POST",
    headers: { "PayPal-Request-Id": `capture-${body.orderId}` },
  });
  if (response?.status === 422) {
    response = await paypalApi(env, `/v2/checkout/orders/${encodeURIComponent(body.orderId)}`);
  }
  if (!response?.ok) return paymentError("PAYPAL_UNAVAILABLE", 502);
  const capture = (await response.json()) as PayPalCapture;
  const amount = capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount;
  if (capture.status !== "COMPLETED" || amount?.currency_code !== order.currency || amount.value !== order.amount) {
    return paymentError("PAYMENT_NOT_COMPLETED", 409);
  }

  const capturedAt = new Date().toISOString();
  const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    `UPDATE paypal_orders SET status = 'COMPLETED', payer_email = ?, captured_at = ?, valid_until = ?
     WHERE paypal_order_id = ? AND user_id = ? AND status <> 'COMPLETED'`,
  ).bind(capture.payer?.email_address ?? null, capturedAt, validUntil, body.orderId, userId).run();

  const credits = await env.DB.prepare(
    "SELECT plan, credits_remaining AS creditsRemaining, credits_total AS creditsTotal, valid_until AS validUntil FROM user_credits WHERE user_id = ?",
  ).bind(userId).first();
  return Response.json({ ok: true, orderId: body.orderId, credits }, { headers: { "Cache-Control": "no-store" } });
}

function paymentError(code: string, status: number) {
  return Response.json({ error: { code } }, { status, headers: { "Cache-Control": "no-store" } });
}
