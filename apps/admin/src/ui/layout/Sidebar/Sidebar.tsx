"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { FaCopy, FaHome, FaImages, FaTags, FaThumbtack } from "react-icons/fa";

import NavItem from "@/ui/layout/NavItem";

const MotionSpan = motion.span;

const ITEMS = [
  { href: "/admin", label: "DashboardScreen", icon: FaHome },
  { href: "/admin/pages", label: "Pages", icon: FaCopy },
  { href: "/admin/posts", label: "Posts", icon: FaThumbtack },
  { href: "/admin/media", label: "Media", icon: FaImages },
  { href: "/admin/taxonomy", label: "Taxonomy", icon: FaTags },
];

export default function Sidebar({
  collapsed,
  onItemClickAction,
}: {
  collapsed: boolean;
  onItemClickAction?: () => void;
}) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <aside className="h-full overflow-hidden flex flex-col">
      <div
        className={`h-14 px-3 flex items-center ${
          collapsed ? "justify-center" : "justify-start"
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {collapsed ? (
            <MotionSpan
              key="np"
              className="font-semibold"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              suppressHydrationWarning
            >
              NP
            </MotionSpan>
          ) : (
            <MotionSpan
              key="nextpress"
              className="font-semibold"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              suppressHydrationWarning
            >
              NextPress
            </MotionSpan>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 px-2 py-2 space-y-1">
        {ITEMS.map((it) => {
          const active = isActive(it.href);

          return (
            <div
              key={it.href}
              className={collapsed ? "tooltip tooltip-right" : undefined}
              data-tip={collapsed ? it.label : undefined}
            >
              <NavItem
                href={it.href}
                label={it.label}
                IconAction={it.icon}
                active={active}
                collapsed={collapsed}
                onClickAction={onItemClickAction}
              />
            </div>
          );
        })}
      </div>
    </aside>
  );
}
