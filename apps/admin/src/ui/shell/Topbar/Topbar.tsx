"use client";

import dynamic from "next/dynamic";
import React from "react";

import type { UserWithRole } from "./TopBar.types"
import { useSession } from "@/lib/auth/auth-client";
import { ThemeToggle, UserAvatar } from "@/ui/components";
import { Breadcrumbs } from "@/ui/shell";

const UserMenu = dynamic(
  () => import("@/ui/shell").then((m) => m.UserMenu),
  { ssr: false }
);

export default function Topbar({
 scrolled,
}: {
  collapsed: boolean;
  scrolled: boolean;
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
          "rounded-xl border",

          // Base state (no scroll): fully transparent — blends with layout
          !scrolled && "bg-transparent border-transparent shadow-none",

          // Scrolled: use CSS variables → consistent with your whole theme
          scrolled && [
            "bg-base-100",
            "border-base-300",
            "shadow-[0_8px_24px_rgba(0,0,0,0.08)]",
          ].join(" "),
        ].join(" ")}


      >
        <div className="flex items-center gap-3">
          <Breadcrumbs />
        </div>

        <div className="flex items-center gap-2">
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
