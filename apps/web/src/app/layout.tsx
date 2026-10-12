import { he } from "@sagarnu/i18n";
import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";

const heebo = Heebo({ subsets: ["hebrew", "latin"], variable: "--font-heebo", display: "swap" });

export const metadata: Metadata = {
  title: { default: he.app.title, template: he.app.titleTemplate },
  description: he.app.description,
};

export const viewport: Viewport = { themeColor: "#faf7f4", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
