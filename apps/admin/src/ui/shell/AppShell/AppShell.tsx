"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

import type { RoleName } from "@/lib/auth/roles";
import { useStickyScrolled } from "@/ui/hooks/useStickyScrolled";
import { Sidebar, Topbar } from "@/ui/shell";
import type { ReactNode } from "react";

const MotionDiv = motion.div;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = () => setIsDesktop(mq.matches);
    handler();
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  return isDesktop;
}

export default function AppShell({
  children,
  role,
}: {
  children: ReactNode;
  role: RoleName | null;
}) {
  const isDesktop = useIsDesktop();

  // SSR-safe initial state: always false on first render
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  const scrollRef = useRef<HTMLDivElement>(null);
  const desktopNavRef = useRef<HTMLDivElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mobileNavRef = useRef<HTMLElement | null>(null);
  const openedPathRef = useRef(pathname);
  const wasDrawerOpenRef = useRef(false);

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

  const scrolled = useStickyScrolled(scrollRef);

  useEffect(() => {
    if (!isDesktop || !drawerOpen) return;
    // The media query is an external lifecycle boundary; clear its dependent UI state here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrawerOpen(false);
    desktopNavRef.current?.querySelector<HTMLElement>("a")?.focus();
  }, [drawerOpen, isDesktop]);

  // Keep the drawer in sync with browser back/forward navigation.
  useEffect(() => {
    if (openedPathRef.current !== pathname) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDrawerOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (drawerOpen) {
      if (!wasDrawerOpenRef.current) {
        openedPathRef.current = pathname;
        wasDrawerOpenRef.current = true;
        mobileNavRef.current?.querySelector<HTMLElement>("a")?.focus();
      }
      return;
    }
    if (!isDesktop && wasDrawerOpenRef.current && mobileTriggerRef.current && openedPathRef.current === pathname) {
      mobileTriggerRef.current.focus();
    }
    wasDrawerOpenRef.current = false;
  }, [drawerOpen, isDesktop, pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  const sideW = collapsed ? 60 : 240;

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
      <div className="flex h-full" inert={drawerOpen}>
        <MotionDiv
          ref={desktopNavRef}
          initial={false}
          animate={{ width: isDesktop ? sideW : 0 }}
          transition={{ type: "keyframes", stiffness: 220, damping: 26 }}
          style={{
            width: isDesktop ? sideW : 0,
            willChange: "width",
            height: "calc(100% - 24px)",
          }}
          className={[
            "hidden lg:block m-3 me-2",
            "bg-base-100 border border-base-300 rounded-2xl shadow",
          ].join(" ")}
          aria-hidden={!isDesktop}
        >
          <Sidebar
            role={role}
            collapsed={collapsed}
            onToggleCollapsedAction={handleSidebarTrigger}
          />
        </MotionDiv>

        <div className="flex-1 min-w-0 flex flex-col">
          <Topbar
            scrolled={scrolled}
            mobileNavOpen={drawerOpen}
            mobileNavTriggerRef={(node) => { mobileTriggerRef.current = node; }}
            onMobileNavOpenAction={() => setDrawerOpen(true)}
          />
          <main
            ref={scrollRef}
            className="px-3 md:px-6 py-4 overflow-auto min-w-0"
          >
            {children}
          </main>
        </div>
      </div>

      <div className="drawer lg:hidden">
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
          <aside
            id="admin-mobile-navigation"
            ref={mobileNavRef}
            className="menu bg-base-100 text-base-content w-60 max-w-[18rem] min-h-full border-r border-base-300 p-0"
            role={drawerOpen ? "dialog" : undefined}
            aria-modal={drawerOpen ? "true" : undefined}
            aria-label={drawerOpen ? "Admin navigation" : undefined}
            aria-hidden={!drawerOpen}
            inert={!drawerOpen}
            onKeyDown={(event) => {
              if (event.key === "Tab") {
                const links = mobileNavRef.current?.querySelectorAll<HTMLElement>("a, button:not([disabled])");
                if (!links?.length) return;
                const first = links[0];
                const last = links[links.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first.focus();
                }
              }
            }}
          >
            <Sidebar
              role={role}
              collapsed={false}
              onItemClickAction={() => setDrawerOpen(false)}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
