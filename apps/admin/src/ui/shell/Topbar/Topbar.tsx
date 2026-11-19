"use client";

import { FaBars } from "react-icons/fa";

import { useSession } from "@/lib/auth/auth-client";
import { ThemeToggle } from "@/ui/components/ThemeToggle";
import { useStickyScrolled } from "@/ui/hooks/useStickyScrolled";
import { Breadcrumbs } from "@/ui/shell/Breadcrumbs";
import { UserMenu } from "@/ui/shell/UserMenu";

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

  return (
    <header className="admin-topbar" data-scrolled={scrolled}>
      <a href="#admin-content" className="admin-skip-link">
        Skip to content
      </a>
      <button
        type="button"
        className="btn btn-ghost btn-square admin-nav-trigger"
        aria-label="Open navigation"
        aria-haspopup="dialog"
        aria-expanded={mobileNavOpen}
        aria-controls="admin-mobile-navigation"
        onClick={onMobileNavOpenAction}
      >
        <FaBars size={18} aria-hidden="true" />
      </button>
      <Breadcrumbs />
      <ThemeToggle />
      <UserMenu
        name={user?.name || user?.email || accountName || "Account"}
        image={user?.image ?? undefined}
        role={user?.role ?? accountRole ?? undefined}
      />
      <div
        id="admin-editor-header-actions"
        className="admin-header-actions-slot"
        ref={onEditorActionsSlotAction}
      />
    </header>
  );
}
