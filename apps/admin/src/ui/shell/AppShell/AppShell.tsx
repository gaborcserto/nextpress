"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { useStickyScrolled } from "@/ui/hooks/useStickyScrolled";
import { Sidebar } from "@/ui/shell/Sidebar";
import { Topbar } from "@/ui/shell/Topbar";

import type { ReactNode } from "react";

import type { RoleName } from "@/lib/auth/roles";

const MotionDiv = motion.div;

const desktopQuery = "(min-width: 1024px)";

function subscribeToDesktop(onChange: () => void) {
  const query = window.matchMedia(desktopQuery);
  query.addEventListener?.("change", onChange);

  return () => query.removeEventListener?.("change", onChange);
}

function getDesktopSnapshot() {
  return window.matchMedia(desktopQuery).matches;
}

const sidebarPreferenceKey = "admin.sidebar.collapsed";

function subscribeToSidebarPreference(onChange: () => void) {
  window.addEventListener("storage", onChange);

  return () => window.removeEventListener("storage", onChange);
}

function getSidebarPreference() {
  try {
    return window.localStorage.getItem(sidebarPreferenceKey) === "true";
  } catch {
    return false;
  }
}

export default function AppShell({
  children,
  role,
}: {
  children: ReactNode;
  role: RoleName | null;
}) {
  const isDesktop = useSyncExternalStore(
    subscribeToDesktop,
    getDesktopSnapshot,
    () => false,
  );

  const storedCollapsed = useSyncExternalStore(
    subscribeToSidebarPreference,
    getSidebarPreference,
    () => false,
  );
  const [collapsedOverride, setCollapsedOverride] = useState<boolean | null>(
    null,
  );
  const collapsed = collapsedOverride ?? storedCollapsed;
  const pathname = usePathname();
  const [drawerPath, setDrawerPath] = useState<string | null>(null);
  const drawerOpen =
    drawerPath !== null && drawerPath === pathname && !isDesktop;

  if (drawerPath !== null && !drawerOpen) {
    setDrawerPath(null);
  }

  const scrollRef = useRef<HTMLDivElement>(null);
  const desktopNavRef = useRef<HTMLDivElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mobileNavRef = useRef<HTMLElement | null>(null);
  const openedPathRef = useRef(pathname);
  const wasDrawerOpenRef = useRef(false);

  const scrolled = useStickyScrolled(scrollRef);

  useEffect(() => {
    if (drawerOpen) {
      if (!wasDrawerOpenRef.current) {
        openedPathRef.current = pathname;
        wasDrawerOpenRef.current = true;
        mobileNavRef.current?.querySelector<HTMLElement>("a")?.focus();
      }

      return;
    }

    if (wasDrawerOpenRef.current) {
      if (isDesktop) {
        // The background is no longer inert after the closed state commits.
        desktopNavRef.current?.querySelector<HTMLElement>("a")?.focus();
      } else if (
        mobileTriggerRef.current &&
        openedPathRef.current === pathname
      ) {
        mobileTriggerRef.current.focus();
      }
    }
    wasDrawerOpenRef.current = false;
  }, [drawerOpen, isDesktop, pathname]);

  useEffect(() => {
    if (!drawerOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setDrawerPath(null);
    };
    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  const sideW = collapsed ? 60 : 240;

  const handleSidebarTrigger = () => {
    if (!isDesktop) {
      setDrawerPath(pathname);

      return;
    }
    const next = !collapsed;
    setCollapsedOverride(next);

    try {
      window.localStorage.setItem(sidebarPreferenceKey, String(next));
    } catch {
      // The sidebar can still be toggled when storage is unavailable.
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
            mobileNavTriggerRef={(node) => {
              mobileTriggerRef.current = node;
            }}
            onMobileNavOpenAction={() => setDrawerPath(pathname)}
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
          onChange={(e) => setDrawerPath(e.target.checked ? pathname : null)}
        />
        <div className="drawer-content" />
        {/* Expose the open drawer immediately for focus; retain its opacity and slide transitions. */}
        <div
          className={
            drawerOpen
              ? "drawer-side z-30 [transition-property:opacity]"
              : "drawer-side z-30"
          }
        >
          <label
            htmlFor="admin-drawer"
            aria-label="close sidebar"
            className="drawer-overlay"
            onClick={() => setDrawerPath(null)}
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
                const links =
                  mobileNavRef.current?.querySelectorAll<HTMLElement>(
                    "a, button:not([disabled])",
                  );

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
              onItemClickAction={() => setDrawerPath(null)}
              onCloseAction={() => setDrawerPath(null)}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
