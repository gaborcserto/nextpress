"use client";

import { useEffect, useRef } from "react";
import { FaBars } from "react-icons/fa";
import { FiCheck, FiGlobe } from "react-icons/fi";

import { useSession } from "@/lib/auth/auth-client";
import { setAdminLocale, useAdminLocale } from "@/lib/i18n/admin-locale";
import { ThemeToggle } from "@/ui/components/ThemeToggle";
import { useStickyScrolled } from "@/ui/hooks/useStickyScrolled";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@/ui/primitives/Dropdown";
import { Breadcrumbs } from "@/ui/shell/Breadcrumbs";
import { UserMenu } from "@/ui/shell/UserMenu";

import type { MouseEvent } from "react";

import type { UserWithRole } from "./Topbar.types";

export default function Topbar({
  mobileNavOpen,
  accountName,
  accountRole,
  onMobileNavOpenAction,
  onEditorActionsSlotAction,
}: {
  mobileNavOpen: boolean;
  accountName?: string | null;
  accountRole?: string | null;
  onMobileNavOpenAction: () => void;
  onEditorActionsSlotAction?: (slot: HTMLElement | null) => void;
}) {
  const { data } = useSession();
  const scrolled = useStickyScrolled();
  const user = data?.user as UserWithRole | undefined;
  const locale = useAdminLocale();

  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = headerRef.current;

    if (!header || typeof ResizeObserver === "undefined") {
      return;
    }

    const rootStyle = document.documentElement.style;

    const updateHeaderSize = () => {
      const height = header.offsetHeight;
      rootStyle.setProperty("--admin-topbar-size", `${height}px`);
      header.toggleAttribute("data-tall", height > window.innerHeight * 0.4);
    };

    const observer = new ResizeObserver(updateHeaderSize);
    observer.observe(header);
    window.addEventListener("resize", updateHeaderSize);
    updateHeaderSize();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeaderSize);
      rootStyle.removeProperty("--admin-topbar-size");
    };
  }, []);

  function openNavigation(event: MouseEvent<HTMLButtonElement>) {
    event.currentTarget.focus();
    onMobileNavOpenAction();
  }

  return (
    <header ref={headerRef} className="admin-topbar" data-scrolled={scrolled}>
      <a href="#admin-content" className="admin-skip-link">
        Skip to content
      </a>
      <div className="admin-topbar-row">
        <button
          type="button"
          className="btn btn-ghost btn-square admin-nav-trigger"
          aria-label="Open navigation"
          aria-haspopup="dialog"
          aria-expanded={mobileNavOpen}
          aria-controls="admin-mobile-navigation"
          onClick={openNavigation}
        >
          <FaBars size={18} aria-hidden="true" />
        </button>
        <Breadcrumbs />
        <div className="admin-topbar-controls">
          <Dropdown>
            <DropdownTrigger
              ariaLabel={
                locale === "hu"
                  ? "Admin nyelve: Magyar"
                  : "Admin language: English"
              }
              className="btn-square"
            >
              <FiGlobe size={19} aria-hidden="true" />
            </DropdownTrigger>
            <DropdownMenu
              aria-label={locale === "hu" ? "Admin nyelve" : "Admin language"}
            >
              <DropdownItem
                itemKey="en"
                role="menuitemradio"
                aria-checked={locale === "en"}
                endIcon={locale === "en" ? <FiCheck /> : undefined}
                onClick={() => setAdminLocale("en")}
              >
                English
              </DropdownItem>
              <DropdownItem
                itemKey="hu"
                role="menuitemradio"
                aria-checked={locale === "hu"}
                endIcon={locale === "hu" ? <FiCheck /> : undefined}
                onClick={() => setAdminLocale("hu")}
              >
                Magyar
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
          <ThemeToggle />
          <UserMenu
            name={user?.name || user?.email || accountName || "Account"}
            image={user?.image ?? undefined}
            role={user?.role ?? accountRole ?? undefined}
          />
        </div>
      </div>
      <div
        id="admin-editor-header-actions"
        className="admin-header-actions-slot"
        ref={onEditorActionsSlotAction}
      />
    </header>
  );
}
