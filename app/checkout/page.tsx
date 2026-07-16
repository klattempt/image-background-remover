import type { Metadata } from "next";
import { PayPalCheckout } from "@/components/paypal-checkout";

export const metadata: Metadata = {
  title: "Checkout — Cutline",
  description: "Complete your one-time Cutline credit purchase with PayPal.",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return <PayPalCheckout />;
}
