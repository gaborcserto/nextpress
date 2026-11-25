"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

import { useModalDialog } from "@/ui/hooks/useModalDialog";
import { EditorHeaderContext } from "@/ui/shell/EditorHeaderContext";
import { Sidebar } from "@/ui/shell/Sidebar";
import { Topbar } from "@/ui/shell/Topbar";

import type { ReactNode } from "react";

import type { RoleName } from "@/lib/auth/roles";

const desktopQuery = "(min-width: 64rem)";
const sidebarPreferenceKey = "admin.sidebar.collapsed";

function subscribeToDesktop(onChange: () => void) {
  const query = window.matchMedia(desktopQuery);
  query.addEventListener("change", onChange);

  return () => query.removeEventListener("change", onChange);
}

function getDesktopSnapshot() {
  return window.matchMedia(desktopQuery).matches;
}

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
  accountName,
}: {
  children: ReactNode;
  role: RoleName | null;
  accountName?: string | null;
}) {
  const pathname = usePathname();
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
  const [navigationPath, setNavigationPath] = useState<string | null>(null);
  const [editorHeaderSlot, setEditorHeaderSlot] = useState<HTMLElement | null>(
    null,
  );
  const collapsed = collapsedOverride ?? storedCollapsed;
  const navigationOpen = navigationPath === pathname && !isDesktop;
  const dialogRef = useModalDialog(navigationOpen);
  const desktopNavRef = useRef<HTMLDivElement>(null);
  const previousNavigationOpen = useRef(false);

  if (navigationPath !== null && !navigationOpen) {
    setNavigationPath(null);
  }

  useLayoutEffect(() => {
    if (navigationOpen) {
      dialogRef.current?.querySelector("button")?.focus();
    } else if (previousNavigationOpen.current && isDesktop) {
      const rail = desktopNavRef.current;
      const destination =
        rail?.querySelector<HTMLElement>('[aria-current="page"]') ??
        rail?.querySelector<HTMLElement>("nav a");
      destination?.focus();
    }

    previousNavigationOpen.current = navigationOpen;
  }, [navigationOpen, isDesktop, dialogRef]);

  function toggleSidebar() {
    const next = !collapsed;
    setCollapsedOverride(next);

    try {
      window.localStorage.setItem(sidebarPreferenceKey, String(next));
    } catch {
      // The rail preference still applies for the current visit.
    }
  }

  function closeNavigation() {
    setNavigationPath(null);
  }

  return (
    <EditorHeaderContext.Provider value={editorHeaderSlot}>
      <div className="admin-shell">
        <div
          className="admin-rail"
          data-collapsed={collapsed}
          ref={desktopNavRef}
        >
          <Sidebar
            role={role}
            collapsed={collapsed}
            onToggleCollapsedAction={toggleSidebar}
          />
        </div>
        <div className="admin-workspace">
          <Topbar
            mobileNavOpen={navigationOpen}
            accountName={accountName}
            accountRole={role}
            onMobileNavOpenAction={() => setNavigationPath(pathname)}
            onEditorActionsSlotAction={setEditorHeaderSlot}
          />
          <main id="admin-content" className="admin-content" tabIndex={-1}>
            {children}
          </main>
        </div>

        <dialog
          id="admin-mobile-navigation"
          className="admin-mobile-navigation"
          ref={dialogRef}
          aria-label="Admin navigation"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget && !isDesktop) {
              closeNavigation();
            }
          }}
          onCancel={(event) => {
            event.preventDefault();
            closeNavigation();
          }}
        >
          {navigationOpen && (
            <Sidebar
              role={role}
              collapsed={false}
              onItemClickAction={closeNavigation}
              onCloseAction={closeNavigation}
            />
          )}
        </dialog>
      </div>
    </EditorHeaderContext.Provider>
  );
}
