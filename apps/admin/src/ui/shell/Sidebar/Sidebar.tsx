"use client";

import { usePathname } from "next/navigation";
import {
  FaCog,
  FaCopy,
  FaHome,
  FaImages,
  FaNewspaper,
  FaStream,
  FaTags,
  FaTimes,
  FaUsers,
} from "react-icons/fa";
import {
  TbLayoutSidebarLeftCollapseFilled,
  TbLayoutSidebarRightExpandFilled,
} from "react-icons/tb";

import { useMediaMessages } from "@/components/admin/Media/messages";
import { useAdminLocale } from "@/lib/i18n/admin-locale";
import { AdminLogo } from "@/ui/components/AdminLogo";
import { NavItem } from "@/ui/shell/NavItem";

import type { NavConfig, SidebarProps } from "./Sidebar.types";

const publishingItems: readonly NavConfig[] = [
  { href: "/admin", label: "Dashboard", icon: FaHome },
  { href: "/admin/pages", label: "Pages", icon: FaCopy },
  { href: "/admin/posts", label: "Posts", icon: FaNewspaper },
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
  const locale = useAdminLocale();
  const mediaText = useMediaMessages();
  const labels =
    locale === "hu"
      ? {
          dashboard: "Vezérlőpult",
          pages: "Oldalak",
          posts: "Bejegyzések",
          taxonomy: "Taxonómia",
          users: "Felhasználók",
          settings: "Beállítások",
          menus: "Menük",
          publishing: "Közzététel",
          administration: "Adminisztráció",
          expand: "Oldalsáv kinyitása",
          collapse: "Oldalsáv összecsukása",
          collapseText: "Összecsukás",
        }
      : {
          dashboard: "Dashboard",
          pages: "Pages",
          posts: "Posts",
          taxonomy: "Taxonomy",
          users: "Users",
          settings: "Settings",
          menus: "Menus",
          publishing: "Publishing",
          administration: "Administration",
          expand: "Expand sidebar",
          collapse: "Collapse sidebar",
          collapseText: "Collapse",
        };
  const editorialItems =
    role && role !== "SUBSCRIBER"
      ? [
          ...publishingItems,
          { href: "/admin/settings/menus", label: "Menus", icon: FaStream },
          { href: "/admin/media", label: mediaText.library, icon: FaImages },
        ]
      : publishingItems;
  const collapseLabel = collapsed ? labels.expand : labels.collapse;
  const groups =
    role === "ADMIN"
      ? [
          { label: labels.publishing, items: editorialItems },
          { label: labels.administration, items: administrationItems },
        ]
      : [{ label: labels.publishing, items: editorialItems }];

  const activeHref = groups
    .flatMap(({ items }) => items)
    .reduce<string | undefined>((active, { href }) => {
      const matches =
        pathname === href ||
        (href !== "/admin" && pathname.startsWith(href + "/"));

      return matches && href.length > (active?.length ?? 0) ? href : active;
    }, undefined);

  return (
    <div className="admin-sidebar" data-collapsed={collapsed}>
      <nav aria-label="Admin navigation" className="admin-sidebar-nav">
        <div className="admin-sidebar-heading">
          <AdminLogo collapsed={collapsed} />
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
        {groups.map(({ label, items }) => (
          <div key={label} className="admin-nav-section">
            <p className={collapsed ? "sr-only" : "admin-nav-label"}>{label}</p>
            <ul aria-label={label} className="admin-nav-group">
              {items.map(({ href, label: itemLabel, icon }) => (
                <li key={href}>
                  <NavItem
                    href={href}
                    label={
                      locale === "hu"
                        ? ({
                            Dashboard: "Vezérlőpult",
                            Pages: "Oldalak",
                            Posts: "Bejegyzések",
                            Taxonomy: "Taxonómia",
                            Users: "Felhasználók",
                            Settings: "Beállítások",
                            Menus: "Menük",
                          }[itemLabel] ?? itemLabel)
                        : itemLabel
                    }
                    IconAction={icon}
                    active={href === activeHref}
                    collapsed={collapsed}
                    onClickAction={onItemClickAction}
                  />
                </li>
              ))}
            </ul>
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
            {!collapsed && <span>{labels.collapseText}</span>}
          </button>
        </div>
      )}
    </div>
  );
}
