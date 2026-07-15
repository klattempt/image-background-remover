import type { Metadata } from "next";
import { AuthPortal } from "@/components/auth-portal";

export const metadata: Metadata = {
  title: "Register — Cutline",
  description: "Create your Cutline account securely with Google.",
};

export default function RegisterPage() {
  return <AuthPortal mode="register" />;
}
