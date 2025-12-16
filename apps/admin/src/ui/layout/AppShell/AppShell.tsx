"use client";

import { motion } from "framer-motion";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { useStickyScrolled } from "@/ui/hooks/useStickyScrolled";
import Sidebar from "@/ui/layout/Sidebar";
import Topbar from "@/ui/layout/Topbar";
import type { ReactNode } from "react";

const MotionDiv = motion.div;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = () => setIsDesktop(mq.matches);
    handler();
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  return isDesktop;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const isDesktop = useIsDesktop();

  // SSR-safe initial state: always false on first render
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = window.localStorage.getItem("admin.sidebar.collapsed");
      if (stored === null) return;

      const next = stored === "true";

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed((prev) => (prev === next ? prev : next));
    } catch {
      // ignore storage errors
    }
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolled = useStickyScrolled(scrollRef);

  const sideW = useMemo(() => (collapsed ? 60 : 240), [collapsed]);

  const handleSidebarTrigger = () => {
    if (isDesktop) {
      setCollapsed((prev) => {
        const next = !prev;
        try {
          window.localStorage.setItem("admin.sidebar.collapsed", String(next));
        } catch {
          // ignore
        }
        return next;
      });
    } else {
      setDrawerOpen(true);
    }
  };

  return (
    <div className="h-dvh overflow-hidden bg-linear-to-br from-base-200 to-base-300">
      <div className="flex h-full">
        <MotionDiv
          initial={false}
          animate={{ width: isDesktop ? sideW : 0 }}
          transition={{ type: "keyframes", stiffness: 220, damping: 26 }}
          style={{
            width: isDesktop ? sideW : 0,
            willChange: "width",
            height: "calc(100% - 24px)",
          }}
          className={[
            "hidden md:block m-3 me-2",
            "bg-base-100 border border-base-300 rounded-2xl shadow",
          ].join(" ")}
          aria-hidden={!isDesktop}
        >
          <Sidebar collapsed={collapsed} />
        </MotionDiv>

        <div className="flex-1 min-w-0 flex flex-col">
          <Topbar
            collapsed={collapsed}
            toggleSidebarAction={handleSidebarTrigger}
            scrolled={scrolled}
          />
          <main
            ref={scrollRef}
            className="px-4 md:px-6 py-4 overflow-auto min-w-0"
          >
            {children}
          </main>
        </div>
      </div>

      <div className="drawer md:hidden">
        <input
          id="admin-drawer"
          type="checkbox"
          className="drawer-toggle"
          checked={drawerOpen}
          onChange={(e) => setDrawerOpen(e.target.checked)}
        />
        <div className="drawer-content" />
        <div className="drawer-side z-30">
          <label
            htmlFor="admin-drawer"
            aria-label="close sidebar"
            className="drawer-overlay"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="menu bg-base-100 text-base-content w-60 max-w-[18rem] min-h-full border-r border-base-300 p-0">
            <Sidebar
              collapsed={false}
              onItemClickAction={() => setDrawerOpen(false)}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
