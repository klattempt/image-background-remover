"use client";

import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type PayPalButtons = { render: (target: string | HTMLElement) => Promise<void>; close?: () => Promise<void> };
type PayPalNamespace = {
  Buttons: (options: {
    style: { layout: string; shape: string; label: string; height: number };
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }) => Promise<void>;
    onCancel: () => void;
    onError: () => void;
  }) => PayPalButtons;
};

declare global {
  interface Window { paypal?: PayPalNamespace }
}

const planDetails = {
  plus: { name: "Plus", amount: "$19.00", credits: 40 },
  pro: { name: "Pro", amount: "$69.00", credits: 200 },
} as const;

export function PayPalCheckout() {
  const [planId, setPlanId] = useState<keyof typeof planDetails | null>(null);
  const [status, setStatus] = useState("Preparing secure checkout…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const requestedPlan = new URLSearchParams(window.location.search).get("plan");
    if (requestedPlan !== "plus" && requestedPlan !== "pro") {
      window.location.replace("/pricing");
      return;
    }
    const planTimer = window.setTimeout(() => setPlanId(requestedPlan), 0);

    let buttons: PayPalButtons | null = null;
    let cancelled = false;
    async function initialize() {
      const sessionResponse = await fetch("/api/auth/session", { headers: { Accept: "application/json" } });
      const session = (await sessionResponse.json()) as { user?: unknown };
      if (!session.user) {
        const returnTo = `/checkout?plan=${requestedPlan}`;
        window.location.replace(`/register?return_to=${encodeURIComponent(returnTo)}#login`);
        return;
      }

      const configResponse = await fetch("/api/paypal/config", { headers: { Accept: "application/json" } });
      if (!configResponse.ok) throw new Error("PayPal Sandbox is not configured.");
      const config = (await configResponse.json()) as { clientId: string; currency: string };
      const scriptId = "paypal-sdk";
      let script = document.getElementById(scriptId) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = scriptId;
        script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(config.clientId)}&currency=${config.currency}&intent=capture&components=buttons`;
        script.async = true;
        document.head.appendChild(script);
        await new Promise<void>((resolve, reject) => {
          script?.addEventListener("load", () => resolve(), { once: true });
          script?.addEventListener("error", () => reject(new Error("Unable to load PayPal.")), { once: true });
        });
      } else if (!window.paypal) {
        await new Promise<void>((resolve, reject) => {
          script?.addEventListener("load", () => resolve(), { once: true });
          script?.addEventListener("error", () => reject(new Error("Unable to load PayPal.")), { once: true });
        });
      }
      if (cancelled || !window.paypal) return;

      document.getElementById("paypal-button-container")?.replaceChildren();
      buttons = window.paypal.Buttons({
        style: { layout: "vertical", shape: "rect", label: "paypal", height: 48 },
        createOrder: async () => {
          setError(null);
          const response = await fetch("/api/paypal/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: requestedPlan }),
          });
          const body = (await response.json()) as { orderId?: string };
          if (!response.ok || !body.orderId) throw new Error("Unable to create the PayPal order.");
          return body.orderId;
        },
        onApprove: async ({ orderID }) => {
          setStatus("Confirming your payment…");
          const response = await fetch("/api/paypal/capture-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: orderID }),
          });
          if (!response.ok) throw new Error("Payment was approved but could not be confirmed.");
          window.location.assign(`/payment/success?order_id=${encodeURIComponent(orderID)}`);
        },
        onCancel: () => window.location.assign("/pricing?payment=cancelled"),
        onError: () => setError("PayPal could not complete the payment. Please try again."),
      });
      await buttons.render("#paypal-button-container");
      setStatus("");
    }

    void initialize().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Checkout is unavailable.");
      setStatus("");
    });
    return () => {
      window.clearTimeout(planTimer);
      cancelled = true;
      void buttons?.close?.();
    };
  }, []);

  const plan = planId ? planDetails[planId] : null;
  return (
    <main className="checkout-page">
      <nav className="auth-nav">
        <Link className="brand" href="/" prefetch={false}><span className="brand-mark"><span /></span>CUTLINE</Link>
        <Link className="back-home" href="/pricing" prefetch={false}><ArrowLeft size={15} /> Back to pricing</Link>
      </nav>
      <section className="checkout-layout">
        <div className="checkout-summary">
          <div className="eyebrow"><span>03</span> Secure checkout</div>
          <h1>Finish your<br /><em>credit purchase.</em></h1>
          <div className="checkout-assurance"><ShieldCheck size={18} /> PayPal Sandbox processes the payment. Cutline never receives your card details.</div>
        </div>
        <div className="checkout-card">
          <div className="account-card-topline"><span>ORDER / ONE TIME</span><i /></div>
          <div className="checkout-plan"><div><small>Selected plan</small><h2>{plan?.name ?? "—"}</h2></div><strong>{plan?.amount ?? "—"}</strong></div>
          <dl className="checkout-details">
            <div><dt>Credits</dt><dd>{plan?.credits ?? "—"} images</dd></div>
            <div><dt>Validity</dt><dd>30 days after payment</dd></div>
            <div><dt>Renewal</dt><dd>None</dd></div>
            <div><dt>Currency</dt><dd>USD</dd></div>
          </dl>
          {status ? <div className="checkout-status">{status}</div> : null}
          {error ? <div className="credential-error" role="alert">{error}</div> : null}
          <div id="paypal-button-container" className="paypal-button-container" />
          <p className="checkout-secure"><LockKeyhole size={13} /> Encrypted checkout via PayPal</p>
        </div>
      </section>
    </main>
  );
}
