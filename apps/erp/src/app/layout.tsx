import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

/* Inter, the storefront's body face — one type voice across the whole site. */
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Heristiq ERP", template: "%s — Heristiq ERP" },
  description: "Inventory and sales for Heristiq",
  /* Admin, behind a login, and nothing here should ever reach an index. */
  robots: { index: false, follow: false, nocache: true },
};

export const viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
