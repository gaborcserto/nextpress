"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

import { useAdminLocale } from "@/lib/i18n/admin-locale";

import type { DetailTitle } from "./Breadcrumbs.types";

function toLabel(
  segment: string,
  parent: string | undefined,
  locale: "en" | "hu",
) {
  if (parent === "pages" || parent === "posts") {
    const contentType =
      parent === "pages"
        ? locale === "hu"
          ? "Oldal"
          : "Page"
        : locale === "hu"
          ? "Bejegyzés"
          : "Post";
    const action =
      segment === "new" || segment === "create"
        ? locale === "hu"
          ? "Létrehozás"
          : "Create"
        : locale === "hu"
          ? "Szerkesztés"
          : "Edit";

    return `${action} ${contentType}`;
  }

  const words = segment.replace(/-/g, " ");

  return words.charAt(0).toUpperCase() + words.slice(1);
}

export default function Breadcrumbs() {
  const pathname = usePathname();
  const locale = useAdminLocale();
  const segments = pathname.split("/").filter(Boolean);

  const [detailTitle, setDetailTitle] = useState<DetailTitle | null>(null);

  const last = segments[segments.length - 1];
  const secondLast = segments[segments.length - 2];

  // Detect detail pages: /admin/pages/:id or /admin/posts/:id
  const isDetail =
    (secondLast === "pages" || secondLast === "posts") &&
    last !== "new" &&
    last !== "create";

  const detailId = isDetail ? last : null;
  const isPostDetail = isDetail && secondLast === "posts";

  // Fetch title for the current detail item
  useEffect(() => {
    if (!detailId) {
      return;
    }

    const controller = new AbortController();
    const basePath = isPostDetail ? "/api/post" : "/api/pages";

    fetch(`${basePath}/${detailId}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const title = data?.item?.title ?? data?.title;

        if (typeof title === "string") {
          setDetailTitle({ id: detailId, title });
        }
      })
      .catch(() => {});

    return () => controller.abort();
  }, [detailId, isPostDetail]);

  const items = segments.flatMap((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const isLast = i === segments.length - 1;
    const prev = segments[i - 1];

    if (pathname === "/admin/settings/menus" && seg === "settings") {
      return [];
    }

    // Default label from segment
    let label =
      seg === "admin"
        ? isLast
          ? locale === "hu"
            ? "Vezérlőpult"
            : "Dashboard"
          : "Admin"
        : toLabel(seg, prev, locale);

    // Override with loaded title when it matches the current detail id
    if (detailId && seg === detailId && detailTitle?.id === seg) {
      label = detailTitle.title;
    }

    if (seg === "media") {
      label = locale === "hu" ? "Médiatár" : "Media Library";
    }

    if (seg === "menus") {
      label = locale === "hu" ? "Menük" : "Menus";
    }

    return [{ href, label, isLast }];
  });

  if (segments.length === 1 && segments[0] === "admin") {
    items.unshift({ href: "/admin", label: "Admin", isLast: false });
  }

  if (items.length === 0) {
    return (
      <nav aria-label="Breadcrumb" className="admin-breadcrumbs">
        <ol>
          <li>
            <Link href="/admin">
              {locale === "hu" ? "Vezérlőpult" : "Dashboard"}
            </Link>
          </li>
        </ol>
      </nav>
    );
  }

  return (
    <nav aria-label="Breadcrumb" className="admin-breadcrumbs">
      <ol>
        {items.map(({ href, label, isLast }) => (
          <li key={`${href}-${label}`}>
            {isLast ? (
              <span aria-current="page" title={label}>
                {label}
              </span>
            ) : (
              <Link href={href}>{label}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
