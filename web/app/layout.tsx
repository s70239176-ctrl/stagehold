import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "../components/SiteHeader.tsx";
import { ToastProvider } from "../components/Toast.tsx";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stagehold: pay for what a panel can see",
  description:
    "Construction payments released stage by stage, judged from a photograph by a GenLayer validator panel that neither the payer nor the builder chose.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#080a0d" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <SiteHeader />
          {children}
          <SiteFooter />
        </ToastProvider>
      </body>
    </html>
  );
}
