import { consumeRateLimit } from "../../../lib/rate-limit";
import { clientIp, isAllowedOrigin } from "../../../lib/security";
import { authenticatedUserId } from "../../_shared/auth";
import { creemApi, creemPlan } from "../../_shared/creem";
import type { FunctionContext } from "../../_shared/types";

type CheckoutBody = { plan?: unknown };
type CreemCheckout = { id?: string; checkout_url?: string; status?: string };

export async function onRequestPost({ request, env }: FunctionContext) {
  if (!isAllowedOrigin(request, env)) return paymentError("INVALID_REQUEST", 403);
  if (!env.DB || !env.CREEM_WEBHOOK_SECRET) return paymentError("NOT_CONFIGURED", 503);
  const userId = await authenticatedUserId(request, env);
  if (!userId) return paymentError("AUTH_REQUIRED", 401);

  const rate = consumeRateLimit(`creem-checkout:${userId}:${clientIp(request)}`, 10, 15 * 60 * 1000);
  if (!rate.allowed) return paymentError("RATE_LIMITED", 429);

  let body: CheckoutBody;
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return paymentError("INVALID_REQUEST", 400);
  }
  const plan = creemPlan(env, body.plan);
  if (!plan) return paymentError("INVALID_PLAN", 400);

  const internalId = crypto.randomUUID();
  const successUrl = new URL("/payment/success", env.APP_ORIGIN ?? new URL(request.url).origin);
  successUrl.searchParams.set("provider", "creem");
  const response = await creemApi(env, "/v1/checkouts", {
    method: "POST",
    body: JSON.stringify({
      product_id: plan.productId,
      request_id: internalId,
      units: 1,
      success_url: successUrl.toString(),
      metadata: { userId, plan: plan.id },
    }),
  });
  if (!response?.ok) return paymentError("CREEM_UNAVAILABLE", 502);
  const checkout = (await response.json()) as CreemCheckout;
  if (!checkout.id || !checkout.checkout_url) return paymentError("CREEM_UNAVAILABLE", 502);

  await env.DB.prepare(
    `INSERT INTO creem_orders
     (id, checkout_id, user_id, plan, product_id, amount_cents, currency, credits, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?)`,
  ).bind(
    internalId,
    checkout.id,
    userId,
    plan.id,
    plan.productId,
    plan.amountCents,
    plan.credits,
    checkout.status ?? "pending",
    new Date().toISOString(),
  ).run();

  return Response.json({ checkoutUrl: checkout.checkout_url }, { headers: { "Cache-Control": "no-store" } });
}

function paymentError(code: string, status: number) {
  return Response.json({ error: { code } }, { status, headers: { "Cache-Control": "no-store" } });
}
