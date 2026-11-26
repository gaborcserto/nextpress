"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { FaCircleUser, FaRightFromBracket } from "react-icons/fa6";

import { signOut } from "@/lib/auth/auth-client";
import { UserAvatar } from "@/ui/components/UserAvatar";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DropdownDivider,
  DropdownLabel,
} from "@/ui/primitives/Dropdown";
import { showToast } from "@/ui/utils";

import type { UserMenuProps } from "./UserMenu.types";

export default function UserMenu({ name, image, role }: UserMenuProps) {
  const router = useRouter();

  const handleSignOut = useCallback(async () => {
    try {
      const { error } = await signOut();

      if (error) {
        showToast("Sign out failed", "error");

        return;
      }

      router.replace("/auth/sign-in");
    } catch {
      showToast("Sign out failed", "error");
      console.error("Sign out failed");
    }
  }, [router]);

  return (
    <Dropdown align="end">
      <DropdownTrigger
        ariaLabel="Open user menu"
        className="admin-account-trigger btn-square"
      >
        <UserAvatar name={name} image={image} size="sm" />
      </DropdownTrigger>

      <DropdownMenu aria-label="User menu" className="admin-account-menu">
        <DropdownLabel>
          <div className="flex flex-col">
            <span className="text-sm wrap-anywhere">{name}</span>
            <span className="text-xs text-(--text-muted) wrap-anywhere">
              {role ?? "User"}
            </span>
          </div>
        </DropdownLabel>

        <DropdownDivider />

        <DropdownItem
          itemKey="profile"
          startIcon={<FaCircleUser />}
          onClick={() => router.push("/admin/profile")}
        >
          Profile
        </DropdownItem>

        <DropdownItem
          itemKey="logout"
          color="danger"
          startIcon={<FaRightFromBracket />}
          onClick={handleSignOut}
        >
          Sign out
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
