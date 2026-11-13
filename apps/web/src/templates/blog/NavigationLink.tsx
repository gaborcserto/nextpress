"use client";

import { usePathname } from "next/navigation";

import { LocaleLink as Link } from "@/lib/i18n/client";
import { stripLocalePrefix } from "@/lib/i18n/routing";

import type { ReactNode } from "react";

export function NavigationLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const currentPath = usePathname();
  const pathname = currentPath ? stripLocalePrefix(currentPath) : currentPath;
  const targetPath = stripLocalePrefix(href);
  const current =
    pathname === targetPath ||
    (targetPath === "/posts" && pathname?.startsWith("/posts/"));

  return (
    <Link href={href} aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}
