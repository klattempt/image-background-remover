import type { Metadata } from "next";
import { AuthPortal } from "@/components/auth-portal";

export const metadata: Metadata = {
  title: "Personal center — Cutline",
  description: "View and manage your Cutline account.",
};

export default function AccountPage() {
  return <AuthPortal mode="account" />;
}
