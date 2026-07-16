import { verifyPayPalWebhook } from "../../_shared/paypal";
import type { FunctionContext } from "../../_shared/types";

type PayPalEvent = {
  id?: string;
  event_type?: string;
  resource?: {
    supplementary_data?: { related_ids?: { order_id?: string } };
    amount?: { currency_code?: string; value?: string };
  };
};

export async function onRequestPost({ request, env }: FunctionContext) {
  if (!env.DB) return new Response("Not configured", { status: 503 });
  let event: PayPalEvent;
  try {
    event = (await request.json()) as PayPalEvent;
  } catch {
    return new Response("Invalid event", { status: 400 });
  }
  if (!event.id || !event.event_type || !(await verifyPayPalWebhook(env, request, event))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const inserted = await env.DB.prepare(
    "INSERT OR IGNORE INTO paypal_webhook_events (event_id, event_type, received_at) VALUES (?, ?, ?)",
  ).bind(event.id, event.event_type, new Date().toISOString()).run();
  if (inserted.meta?.changes === 0) return new Response("OK");

  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
    const amount = event.resource?.amount;
    if (orderId && amount?.currency_code === "USD") {
      const order = await env.DB.prepare(
        "SELECT amount FROM paypal_orders WHERE paypal_order_id = ?",
      ).bind(orderId).first<{ amount: string }>();
      if (order?.amount === amount.value) {
        const capturedAt = new Date().toISOString();
        const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await env.DB.prepare(
          `UPDATE paypal_orders SET status = 'COMPLETED', captured_at = ?, valid_until = ?
           WHERE paypal_order_id = ? AND status <> 'COMPLETED'`,
        ).bind(capturedAt, validUntil, orderId).run();
      }
    }
  }
  return new Response("OK");
}
