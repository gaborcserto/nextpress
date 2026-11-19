"use client";

import Link from "next/link";

import type { IconType } from "react-icons";

export default function NavItem({
  href,
  label,
  IconAction,
  active = false,
  collapsed = false,
  onClickAction,
}: {
  href: string;
  label: string;
  IconAction: IconType;
  active?: boolean;
  collapsed?: boolean;
  onClickAction?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClickAction}
      className="admin-nav-link"
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
    >
      <IconAction size={18} aria-hidden="true" className="shrink-0" />
      <span className={collapsed ? "sr-only" : undefined}>{label}</span>
    </Link>
  );
}
