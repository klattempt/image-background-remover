import { verifyCreemWebhook } from "../../_shared/creem";
import type { FunctionContext } from "../../_shared/types";

type CreemEvent = {
  id?: string;
  eventType?: string;
  object?: {
    id?: string;
    request_id?: string;
    customer?: { email?: string };
    order?: {
      id?: string;
      product?: string;
      amount?: number;
      currency?: string;
      status?: string;
      mode?: string;
    };
    product?: { id?: string };
  };
};

type CreemOrderRow = {
  checkoutId: string;
  productId: string;
  amountCents: number;
  currency: string;
};

export async function onRequestPost({ request, env }: FunctionContext) {
  if (!env.DB || !env.CREEM_WEBHOOK_SECRET) return new Response("Not configured", { status: 503 });
  const rawBody = await request.text();
  if (!(await verifyCreemWebhook(rawBody, request.headers.get("creem-signature"), env.CREEM_WEBHOOK_SECRET))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: CreemEvent;
  try {
    event = JSON.parse(rawBody) as CreemEvent;
  } catch {
    return new Response("Invalid event", { status: 400 });
  }
  if (!event.id || !event.eventType) return new Response("Invalid event", { status: 400 });

  const previous = await env.DB.prepare(
    "SELECT processed_at AS processedAt FROM creem_webhook_events WHERE event_id = ?",
  ).bind(event.id).first<{ processedAt: string | null }>();
  if (previous?.processedAt) return new Response("OK");
  if (!previous) {
    await env.DB.prepare(
      "INSERT INTO creem_webhook_events (event_id, event_type, received_at) VALUES (?, ?, ?)",
    ).bind(event.id, event.eventType, new Date().toISOString()).run();
  }

  if (event.eventType === "checkout.completed") {
    const checkout = event.object;
    const order = checkout?.order;
    const requestId = checkout?.request_id;
    const productId = order?.product ?? checkout?.product?.id;
    if (!checkout?.id || !requestId || !order?.id || !productId) return new Response("Invalid checkout", { status: 400 });

    const stored = await env.DB.prepare(
      `SELECT checkout_id AS checkoutId, product_id AS productId, amount_cents AS amountCents, currency
       FROM creem_orders WHERE id = ?`,
    ).bind(requestId).first<CreemOrderRow>();
    if (!stored) return new Response("Order not found", { status: 404 });
    if (
      stored.checkoutId !== checkout.id
      || stored.productId !== productId
      || stored.amountCents !== order.amount
      || stored.currency !== order.currency
      || order.status !== "paid"
    ) return new Response("Order mismatch", { status: 409 });

    const capturedAt = new Date().toISOString();
    const isLive = env.CREEM_ENVIRONMENT === "live";
    const validUntil = isLive ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null;
    await env.DB.prepare(
      `UPDATE creem_orders
       SET status = ?, creem_order_id = ?, customer_email = ?, captured_at = ?, valid_until = ?
       WHERE id = ? AND status NOT IN ('COMPLETED', 'TEST_COMPLETED')`,
    ).bind(
      isLive ? "COMPLETED" : "TEST_COMPLETED",
      order.id,
      checkout.customer?.email ?? null,
      capturedAt,
      validUntil,
      requestId,
    ).run();
  }

  await env.DB.prepare(
    "UPDATE creem_webhook_events SET processed_at = ? WHERE event_id = ?",
  ).bind(new Date().toISOString(), event.id).run();
  return new Response("OK");
}
