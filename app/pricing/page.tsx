import type { Metadata } from "next";
import { PricingPage } from "@/components/pricing-page";

export const metadata: Metadata = {
  title: "Pricing — Cutline",
  description: "Simple image background removal pricing for stores of every size.",
  alternates: { canonical: "/pricing" },
};

export default function Pricing() {
  return <PricingPage />;
}
