"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import {
  FaCopy,
  FaHome,
  FaTags,
  FaThumbtack,
  FaUsers,
  FaCog,
} from "react-icons/fa";
import {
  TbLayoutSidebarLeftCollapseFilled,
  TbLayoutSidebarRightExpandFilled,
} from "react-icons/tb";

import type { NavConfig, SidebarProps } from "./Sidebar.types";
import { IconButton } from "@/ui/primitives";
import { NavItem } from "@/ui/shell";
import type { IconType } from "react-icons";

const MotionSpan = motion.span;
const MotionDiv = motion.div;

type ItemInput = { href: string; label: string; icon: IconType };

const ITEMS: readonly ItemInput[] = [
  { href: "/admin", label: "Dashboard", icon: FaHome },
  { href: "/admin/pages", label: "Pages", icon: FaCopy },
  { href: "/admin/posts", label: "Posts", icon: FaThumbtack },
  { href: "/admin/taxonomy", label: "Taxonomy", icon: FaTags },
];

const ADMIN_ITEMS: readonly ItemInput[] = [
  { href: "/admin/users", label: "Users", icon: FaUsers },
  { href: "/admin/settings", label: "Settings", icon: FaCog },
];

export default function Sidebar({
  collapsed,
  role,
  onItemClickAction,
  onToggleCollapsedAction,
}: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === "/admin"
      : pathname === href || pathname.startsWith(href + "/");

  const renderItem = (it: NavConfig) => (
    <div
      key={it.href}
      className={collapsed ? "tooltip tooltip-right" : undefined}
      data-tip={collapsed ? it.label : undefined}
    >
      <NavItem
        href={it.href}
        label={it.label}
        IconAction={it.icon}
        active={isActive(it.href)}
        collapsed={collapsed}
        onClickAction={onItemClickAction}
      />
    </div>
  );

  return (
    <aside className="h-full overflow-visible flex flex-col">
      <div className="h-14 px-3 flex items-center">
        <MotionDiv
          layout
          initial={false}
          className="w-full font-semibold whitespace-nowrap"
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
        >
          <MotionSpan
            layout
            initial={false}
            className={collapsed ? "block w-full text-center" : "block w-full text-left"}
            animate={{
              scale: collapsed ? 1.03 : 1,
              letterSpacing: collapsed ? "0.08em" : "0em",
            }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            suppressHydrationWarning
          >
            {collapsed ? "NP" : "NextPress"}
          </MotionSpan>
        </MotionDiv>
      </div>

      <nav aria-label="Admin navigation" className="flex-1 px-2 py-2 flex flex-col gap-1">
        {ITEMS.map((it) => renderItem(it))}

        {role === "ADMIN" && (
          <>
            <div className="divider my-2" />
            {ADMIN_ITEMS.map((it) => renderItem(it))}
          </>
        )}
      </nav>

      {onToggleCollapsedAction && <div className="px-2 pb-2">
        <div className="divider my-2" />
        <div
          className="tooltip tooltip-right w-full flex justify-start h-10"
          data-tip={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <IconButton
            icon={collapsed ? TbLayoutSidebarLeftCollapseFilled : TbLayoutSidebarRightExpandFilled}
            variant="ghost"
            size="sm"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onToggleCollapsedAction}
          />
        </div>
      </div>}
    </aside>
  );
}
