"use client";

import { usePathname } from "next/navigation";

import { LocaleLink as Link } from "@/lib/i18n/client";
import { stripLocalePrefix } from "@/lib/i18n/routing";

import type { ReactNode } from "react";

export function NavigationLink({
  href,
  children,
  newTab,
  className,
}: {
  href: string;
  newTab?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const currentPath = usePathname();
  const pathname = currentPath ? stripLocalePrefix(currentPath) : currentPath;
  const targetPath = stripLocalePrefix(href);
  const activeRoute =
    pathname === targetPath ||
    (targetPath !== "/" && pathname?.startsWith(`${targetPath}/`));
  const current =
    pathname === targetPath ||
    (targetPath === "/posts" && pathname?.startsWith("/posts/"));

  return (
    <Link
      href={href}
      className={className}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener noreferrer" : undefined}
      aria-current={current ? "page" : undefined}
      data-active-route={activeRoute ? "true" : undefined}
    >
      {children}
    </Link>
  );
}
