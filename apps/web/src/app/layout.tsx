import { Geist, Geist_Mono } from "next/font/google";

import { PublicShell } from "@/components/public-shell/PublicShell";
import { getPublicPageNavigation } from "@/lib/content/public-content.server";
import { getPublicSiteSettings } from "@/lib/settings/public-site-settings.server";
import { publicSkinId, resolvePublicSkin, resolveColorMode } from "@/lib/skin";
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

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSiteSettings();
  return { title: settings.siteName, description: settings.siteDescription };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [settings, navigation] = await Promise.all([getPublicSiteSettings(), getPublicPageNavigation()]);
  const skin = resolvePublicSkin(publicSkinId);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      data-skin={skin.id}
      data-color-mode={resolveColorMode(skin)}
    >
      <body>
        <PublicShell siteName={settings.siteName} headerPages={navigation.header} footerPages={navigation.footer}>
          {children}
        </PublicShell>
      </body>
    </html>
  );
}
