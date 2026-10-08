import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "../components/SiteHeader.tsx";
import { ToastProvider } from "../components/Toast.tsx";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Stagehold: payment follows proof",
  description:
    "Construction payments released stage by stage, judged from a photograph by a GenLayer validator panel that neither the payer nor the builder chose.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0a0b0c" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
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
