import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";

import { publicAppearance } from "@/lib/appearance";
import { LocaleProvider, PreferenceProvider } from "@/lib/i18n/client";
import { isColorMode } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/server";
import { getPublicSiteSettings } from "@/lib/settings/public-site-settings.server";
import { siteOrigin } from "@/lib/settings/seo";
import { resolvePublicSkin, resolveColorMode } from "@/lib/skin";
import { resolveWebsiteAppearance } from "@/lib/website-appearance";

import type { Metadata } from "next";
import "./globals.css";
import "./skins/default.css";
import "../templates/blog/presets.css";

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

  return {
    metadataBase: siteOrigin(),
    title: settings.siteName,
    description: settings.siteDescription,
    robots: { index: true, follow: true },
    openGraph: { siteName: settings.siteName, type: "website" },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getPublicSiteSettings();
  const appearance = resolveWebsiteAppearance(settings.appearance);
  const skin = resolvePublicSkin(publicAppearance.theme);
  const locale = await getLocale();
  const savedMode = (await cookies()).get("np-color-mode")?.value;
  let preference = settings.appearance?.colorMode;

  if (!isColorMode(preference)) {
    preference = "system";
  }
  if (isColorMode(savedMode)) {
    preference = savedMode;
  }

  const mode = resolveColorMode(skin, preference);

  return (
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable}`}
      data-website-template={appearance.websiteTemplate}
      data-style-preset={appearance.stylePreset}
      data-skin={skin.id}
      data-color-mode={mode}
    >
      <body>
        <LocaleProvider locale={locale}>
          <PreferenceProvider mode={mode ?? "light"}>
            {children}
          </PreferenceProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
