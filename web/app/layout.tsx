import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { WEB_MODE_WARNING } from "../lib/config.ts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stagehold",
  description: "Hold a construction payment until a named stage is visible in a photo. A GenLayer validator panel, not either party, is the judge.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="banner" role="note">
          {WEB_MODE_WARNING}
        </div>
        {children}
      </body>
    </html>
  );
}
