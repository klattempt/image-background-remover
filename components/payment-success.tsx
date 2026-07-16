"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Order = { orderId: string; plan: string; amount: string; currency: string; credits: number; status: string; validUntil: string };

export function PaymentSuccess() {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get("order_id");
    if (!orderId) {
      const timer = window.setTimeout(() => setError(true), 0);
      return () => window.clearTimeout(timer);
    }
    void fetch(`/api/paypal/order?order_id=${encodeURIComponent(orderId)}`, { headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<{ order: Order }>;
      })
      .then(({ order: completedOrder }) => setOrder(completedOrder))
      .catch(() => setError(true));
  }, []);

  return (
    <main className="payment-result-page">
      <section className="payment-result-card">
        {error ? (
          <><div className="auth-icon"><CheckCircle2 size={30} /></div><h1>Payment received.</h1><p>We could not load the order details. Open your account to check the latest credit balance.</p></>
        ) : order ? (
          <><div className="auth-icon"><CheckCircle2 size={30} /></div><div className="section-kicker">Payment complete</div><h1>{order.credits} credits<br /><em>are ready.</em></h1><p>Your {order.plan} credit allowance is active until {new Date(order.validUntil).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.</p><div className="payment-order-id">PAYPAL ORDER / {order.orderId}</div></>
        ) : <div className="checkout-status">Confirming your order…</div>}
        <div className="payment-result-actions"><Link className="auth-primary" href="/">Open product studio <ArrowRight size={17} /></Link><Link className="auth-secondary" href="/account">View account</Link></div>
      </section>
    </main>
  );
}
