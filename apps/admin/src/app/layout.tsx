import "./globals.css";
import { cookies } from "next/headers";

import { Providers } from "./providers";
import { ToastHost } from "@/ui/primitives/ToastHost";
import type { Metadata } from "next";
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: "Admin" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value;

  return (
      <html lang="hu" data-theme={theme ?? undefined}>
        <body suppressHydrationWarning>
          <Providers>{children}</Providers>
          <ToastHost />
        </body>
      </html>
  );
}

