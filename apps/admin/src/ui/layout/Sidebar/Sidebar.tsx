"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { FaCopy, FaHome, FaImages, FaTags, FaThumbtack } from "react-icons/fa";

import NavItem from "@/ui/layout/NavItem";

const MotionSpan = motion.span;
const MotionDiv = motion.div;

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
              opacity: 1,
            }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            suppressHydrationWarning
          >
            {collapsed ? "NP" : "NextPress"}
          </MotionSpan>
        </MotionDiv>
      </div>

      <div className="flex-1 px-2 py-2 flex flex-col gap-1">
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
