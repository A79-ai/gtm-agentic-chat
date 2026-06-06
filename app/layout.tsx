import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GTM Agentic Chat",
  description: "Chat over your CRM, meetings, and knowledge base.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
