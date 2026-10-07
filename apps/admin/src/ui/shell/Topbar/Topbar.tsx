"use client";

import dynamic from "next/dynamic";
import React from "react";
import { FaBars } from "react-icons/fa";

import type { UserWithRole } from "./Topbar.types";
import { useSession } from "@/lib/auth/auth-client";
import { ThemeToggle, UserAvatar } from "@/ui/components";
import { Breadcrumbs } from "@/ui/shell";

const UserMenu = dynamic(
  () => import("@/ui/shell").then((m) => m.UserMenu),
  { ssr: false }
);

export default function Topbar({
 scrolled,
 mobileNavOpen,
 mobileNavTriggerRef,
 onMobileNavOpenAction,
}: {
  scrolled: boolean;
  mobileNavOpen: boolean;
  mobileNavTriggerRef: (node: HTMLButtonElement | null) => void;
  onMobileNavOpenAction: () => void;
}) {
  const { data } = useSession(); // { data, isPending, ... }

  const user = data?.user as UserWithRole | undefined;

  const name = user?.name ?? user?.email ?? "Admin";
  const image = user?.image ?? undefined;
  const role = user?.role ?? undefined;

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
      <header
        className={[
          "sticky top-3 z-20 mx-4 md:mx-6 mb-3 h-14 px-4",
          "flex items-center justify-between",
          "transition-[background-color,border-color,box-shadow] duration-300 ease-out",
          "rounded-[var(--radius-surface)] border",

          // Base state (no scroll): fully transparent — blends with layout
          !scrolled && "bg-transparent border-transparent shadow-none",

          // Scrolled: use CSS variables → consistent with your whole theme
          scrolled && [
            "bg-base-100",
            "border-base-300",
            "shadow-[var(--shadow-topbar)]",
          ].join(" "),
        ].join(" ")}


      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            ref={mobileNavTriggerRef}
            type="button"
            id="admin-navigation-trigger"
            className="btn btn-ghost btn-square shrink-0 lg:hidden"
            aria-label="Open navigation"
            aria-expanded={mobileNavOpen}
            aria-controls="admin-mobile-navigation"
            onClick={onMobileNavOpenAction}
          >
            <FaBars aria-hidden="true" />
          </button>
          <Breadcrumbs />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />

          {!mounted ? (
              <UserAvatar name={name} image={image} size="sm" asButton />
          ) : (
              <UserMenu name={name} image={image} role={role} />
          )}
        </div>
      </header>
  );
}
