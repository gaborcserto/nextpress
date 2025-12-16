"use client";

import { useRouter } from "next/navigation";
import React, { useCallback } from "react";
import { FaUserCircle, FaSignOutAlt } from "react-icons/fa";

import type { UserMenuProps } from "./UserMenu.types";
import { signOut } from "@/lib/auth/auth-client";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DropdownDivider,
  DropdownLabel,
} from "@/ui/components/Dropdown/Dropdown";
import UserAvatar from "@/ui/components/UserAvatar";
import { showToast } from "@/ui/utils/toast";


export default function UserMenu({ name, image, role }: UserMenuProps) {
  const router = useRouter();

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      router.replace("/auth/sign-in");
    } catch (e) {
      showToast("Sign out failed", "error");
      console.error(e);
    }
  }, [router]);

  return (
      <Dropdown align="end">
        {/* Trigger (Avatar) */}
        <DropdownTrigger ariaLabel="Open user menu" className="btn btn-ghost btn-circle">
          <UserAvatar name={name} image={image} size="sm" />
        </DropdownTrigger>

        {/* Menu */}
        <DropdownMenu aria-label="User menu">
          <DropdownLabel>
            <div className="flex flex-col">
              <span className="text-sm truncate">{name}</span>
              <span className="text-xs text-base-content/60 truncate">
              {role ?? "User"}
            </span>
            </div>
          </DropdownLabel>

          <DropdownDivider />

          <DropdownItem
            itemKey="profile"
            startIcon={<FaUserCircle />}
            onClick={() => router.push("/admin/profile")}
          >
            Profile
          </DropdownItem>

          <DropdownItem
            itemKey="logout"
            color="danger"
            startIcon={<FaSignOutAlt />}
            onClick={handleSignOut}
          >
            Sign out
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
  );
}
