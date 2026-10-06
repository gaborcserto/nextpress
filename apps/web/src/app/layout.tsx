import { Geist, Geist_Mono } from "next/font/google";

import { PublicShell } from "@/components/public-shell/PublicShell";
import { activeSkin, resolveColorMode } from "@/lib/skin";
import type { Metadata } from "next";
import "./globals.css";
import "./skins/default.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NextPress",
  description: "A publication powered by NextPress.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      data-skin={activeSkin.id}
      data-color-mode={resolveColorMode(activeSkin)}
    >
      <body>
        <PublicShell>{children}</PublicShell>
      </body>
    </html>
  );
}
