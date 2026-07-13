import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cutline — Batch product background remover",
  description:
    "Remove backgrounds from up to 20 ecommerce product photos and export clean white-background images in one batch.",
  metadataBase: new URL(process.env.APP_ORIGIN ?? "http://localhost:3000"),
  alternates: { canonical: "/" },
  openGraph: {
    title: "Cutline — Product photos, production ready",
    description: "Batch-remove backgrounds. Review once. Download a clean product set.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
