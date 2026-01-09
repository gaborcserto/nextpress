"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

import type { IconType } from "react-icons";

const MotionSpan = motion.span;

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
  const baseCls =
      "block h-10 px-3 rounded-lg transition-colors duration-200 focus:outline-none focus-visible:ring focus-visible:ring-primary/30";
  const idleCls = "hover:bg-base-200";
  const activeCls = "bg-primary/10 text-primary hover:bg-primary/15";

  const sizeCls = collapsed ? "w-10 px-0" : "w-full px-3";
  const wrapperCls = `${baseCls} ${sizeCls} ${active ? activeCls : idleCls}`;

  return (
      <Link
        href={href}
        onClick={onClickAction}
        className={wrapperCls}
        aria-current={active ? "page" : undefined}
      >
        <div
          className={[
            "h-full flex items-center",
            collapsed ? "justify-center gap-0" : "justify-start gap-3",
          ].join(" ")}
        >
          <span className={active ? "text-primary shrink-0" : "shrink-0"}>
            <IconAction size={20} />
          </span>

          <AnimatePresence initial={false}>
            {!collapsed && (
              <MotionSpan
                key={label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="truncate leading-none"
                suppressHydrationWarning
              >
                {label}
              </MotionSpan>
            )}
          </AnimatePresence>
        </div>
      </Link>
  );
}
