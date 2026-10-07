import "./globals.css";
import { resolveSkin } from "@nextpress/shared";
import { cookies } from "next/headers";

import { Providers } from "./providers";
import { adminSkinId } from "@/lib/skin";
import { normalizeThemeCookie } from "@/lib/theme";
import { ToastHost } from "@/ui/primitives/ToastHost";
import type { Metadata } from "next";
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: "Admin" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const skin = resolveSkin(adminSkinId);
  const theme = normalizeThemeCookie(cookieStore.get("theme")?.value);

  return (
      <html lang="hu" data-skin={skin.id} data-theme={theme}>
        <body suppressHydrationWarning>
          <Providers>{children}</Providers>
          <ToastHost />
        </body>
      </html>
  );
}

