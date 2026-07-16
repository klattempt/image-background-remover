"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Order = {
  orderId: string;
  plan: string;
  credits: number;
  status: string;
  validUntil: string | null;
  provider: "paypal" | "creem";
};

export function PaymentSuccess() {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const provider = params.get("provider") === "creem" ? "creem" : "paypal";
    const externalId = provider === "creem" ? params.get("checkout_id") : params.get("order_id");
    if (!externalId) {
      const timer = window.setTimeout(() => setError(true), 0);
      return () => window.clearTimeout(timer);
    }

    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;
    const loadOrder = async () => {
      const parameter = provider === "creem" ? "checkout_id" : "order_id";
      const response = await fetch(`/api/${provider}/order?${parameter}=${encodeURIComponent(externalId)}`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error();
      const body = (await response.json()) as { order: Omit<Order, "provider"> };
      if (cancelled) return;
      const completedOrder: Order = { ...body.order, provider };
      if (provider === "creem" && !["COMPLETED", "TEST_COMPLETED"].includes(completedOrder.status) && attempts < 8) {
        attempts += 1;
        timer = window.setTimeout(() => void loadOrder().catch(() => setError(true)), 1500);
        return;
      }
      setOrder(completedOrder);
    };
    void loadOrder().catch(() => setError(true));
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const isCreemTest = order?.provider === "creem" && order.status === "TEST_COMPLETED";
  return (
    <main className="payment-result-page">
      <section className="payment-result-card">
        {error ? (
          <><div className="auth-icon"><CheckCircle2 size={30} /></div><h1>Payment received.</h1><p>We could not load the order details. Open your account to check the latest credit balance.</p></>
        ) : isCreemTest ? (
          <><div className="auth-icon"><CheckCircle2 size={30} /></div><div className="section-kicker">Creem test complete</div><h1>Test payment<br /><em>confirmed.</em></h1><p>The complete test flow worked. No real charge was made and no production credits were issued.</p><div className="payment-order-id">CREEM TEST CHECKOUT / {order.orderId}</div></>
        ) : order?.status === "COMPLETED" ? (
          <><div className="auth-icon"><CheckCircle2 size={30} /></div><div className="section-kicker">Payment complete</div><h1>{order.credits} credits<br /><em>are ready.</em></h1><p>Your {order.plan} credit allowance is active until {order.validUntil ? new Date(order.validUntil).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "the date shown in your account"}.</p><div className="payment-order-id">{order.provider.toUpperCase()} ORDER / {order.orderId}</div></>
        ) : order ? (
          <><div className="checkout-status">Waiting for the payment webhook…</div><p>Your payment provider is still confirming this order. Check your account again in a moment.</p></>
        ) : <div className="checkout-status">Confirming your order…</div>}
        <div className="payment-result-actions"><Link className="auth-primary" href="/">Open product studio <ArrowRight size={17} /></Link><Link className="auth-secondary" href="/account">View account</Link></div>
      </section>
    </main>
  );
}
