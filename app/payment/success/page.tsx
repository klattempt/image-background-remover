import type { Metadata } from "next";
import { PaymentSuccess } from "@/components/payment-success";

export const metadata: Metadata = {
  title: "Payment complete — Cutline",
  robots: { index: false, follow: false },
};

export default function PaymentSuccessPage() {
  return <PaymentSuccess />;
}
