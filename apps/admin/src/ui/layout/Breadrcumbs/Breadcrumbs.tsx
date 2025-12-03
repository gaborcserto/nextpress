"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

import type { DetailTitle } from "./Breadrcumbs.types";


// Build a readable label for each segment
function toLabel(seg: string, prev?: string) {
  const looksLikeId = /^[0-9a-z-]{8,}$/i.test(seg);

  // "new" / "create"
  if ((seg === "new" || seg === "create") && prev) {
    if (prev === "pages") return "Create Page";
    if (prev === "posts") return "Create Post";
    return "New";
  }

  // ID segments
  if (looksLikeId && prev) {
    if (prev === "posts") return "Edit Post";
    if (prev === "pages") return "Edit Page";
    return "Edit";
  }

  // Slug to readable text
  const spaced = seg.replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export default function Breadcrumbs() {
  const pathname = usePathname();
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

  // Fetch title for the current detail item
  useEffect(() => {
    if (!detailId) return;

    const controller = new AbortController();

    fetch(`/api/pages/${detailId}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const title = data?.item?.title ?? data?.title;
        if (typeof title === "string") {
          setDetailTitle({ id: detailId, title });
        }
      })
      .catch(() => {});

    return () => controller.abort();
  }, [detailId]);

  const items = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const isLast = i === segments.length - 1;
    const prev = segments[i - 1];

    // Default label from segment
    let label = toLabel(seg, prev);

    // Override with loaded title when it matches the current detail id
    if (detailId && seg === detailId && detailTitle?.id === seg) {
      label = detailTitle.title;
    }

    return { href, label, isLast };
  });

  if (items.length === 0) {
    return (
      <div className="breadcrumbs text-sm">
        <ul>
          <li>
            <Link href="/admin" className="link link-hover">
              Dashboard
            </Link>
          </li>
        </ul>
      </div>
    );
  }

  return (
    <div aria-label="Breadcrumb" className="breadcrumbs text-sm">
      <ul>
        {items.map(({ href, label, isLast }) => (
          <li key={href} className="max-w-[20ch] sm:max-w-[28ch]">
            {isLast ? (
              <span className="truncate text-base-content/70">{label}</span>
            ) : (
              <Link href={href} className="link link-hover truncate">
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
