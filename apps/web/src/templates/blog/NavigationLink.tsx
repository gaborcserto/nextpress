"use client";

import { usePathname } from "next/navigation";

import { LocaleLink as Link } from "@/lib/i18n/client";
import { stripLocalePrefix } from "@/lib/i18n/routing";

import type { ReactNode } from "react";

export function NavigationLink({
  href,
  children,
  newTab,
}: {
  href: string;
  newTab?: boolean;
  children: ReactNode;
}) {
  const currentPath = usePathname();
  const pathname = currentPath ? stripLocalePrefix(currentPath) : currentPath;
  const targetPath = stripLocalePrefix(href);
  const current =
    pathname === targetPath ||
    (targetPath === "/posts" && pathname?.startsWith("/posts/"));

  return (
    <Link
      href={href}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener noreferrer" : undefined}
      aria-current={current ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
