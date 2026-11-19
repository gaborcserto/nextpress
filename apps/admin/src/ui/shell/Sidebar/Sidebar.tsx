"use client";

import { usePathname } from "next/navigation";
import {
  FaCog,
  FaCopy,
  FaHome,
  FaTags,
  FaThumbtack,
  FaTimes,
  FaUsers,
} from "react-icons/fa";
import {
  TbLayoutSidebarLeftCollapseFilled,
  TbLayoutSidebarRightExpandFilled,
} from "react-icons/tb";

import { NavItem } from "@/ui/shell/NavItem";

import type { NavConfig, SidebarProps } from "./Sidebar.types";

const publishingItems: readonly NavConfig[] = [
  { href: "/admin", label: "Dashboard", icon: FaHome },
  { href: "/admin/pages", label: "Pages", icon: FaCopy },
  { href: "/admin/posts", label: "Posts", icon: FaThumbtack },
  { href: "/admin/taxonomy", label: "Taxonomy", icon: FaTags },
];

const administrationItems: readonly NavConfig[] = [
  { href: "/admin/users", label: "Users", icon: FaUsers },
  { href: "/admin/settings", label: "Settings", icon: FaCog },
];

export default function Sidebar({
  collapsed,
  role,
  onItemClickAction,
  onCloseAction,
  onToggleCollapsedAction,
}: SidebarProps) {
  const pathname = usePathname();
  const collapseLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";
  const groups =
    role === "ADMIN"
      ? [
          { label: "Publishing", items: publishingItems },
          { label: "Administration", items: administrationItems },
        ]
      : [{ label: "Publishing", items: publishingItems }];

  return (
    <div className="admin-sidebar" data-collapsed={collapsed}>
      <div className="admin-sidebar-heading">
        <span className="admin-wordmark" aria-label="NextPress">
          {collapsed ? "NP" : "NextPress"}
        </span>
        {onCloseAction && (
          <button
            type="button"
            aria-label="Close navigation"
            className="btn btn-ghost btn-square admin-nav-trigger"
            onClick={onCloseAction}
          >
            <FaTimes size={18} aria-hidden="true" />
          </button>
        )}
      </div>
      <nav aria-label="Admin navigation" className="admin-sidebar-nav">
        {groups.map(({ label, items }) => (
          <div key={label} className="admin-nav-group">
            <p className={collapsed ? "sr-only" : "admin-nav-label"}>{label}</p>
            {items.map(({ href, label: itemLabel, icon }) => (
              <div key={href}>
                <NavItem
                  href={href}
                  label={itemLabel}
                  IconAction={icon}
                  active={
                    pathname === href ||
                    (href !== "/admin" && pathname.startsWith(href + "/"))
                  }
                  collapsed={collapsed}
                  onClickAction={onItemClickAction}
                />
              </div>
            ))}
          </div>
        ))}
      </nav>
      {onToggleCollapsedAction && (
        <div className="admin-sidebar-footer">
          <button
            type="button"
            aria-label={collapseLabel}
            className="admin-nav-link"
            onClick={onToggleCollapsedAction}
          >
            {collapsed ? (
              <TbLayoutSidebarLeftCollapseFilled size={18} aria-hidden="true" />
            ) : (
              <TbLayoutSidebarRightExpandFilled size={18} aria-hidden="true" />
            )}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      )}
    </div>
  );
}
