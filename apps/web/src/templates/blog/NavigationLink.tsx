"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { ReactNode } from "react";

export function NavigationLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const current =
    pathname === href || (href === "/posts" && pathname?.startsWith("/posts/"));

  return (
    <Link href={href} aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}
