"use client";

import { useAdminLocale } from "@/lib/i18n/admin-locale";
import { Badge } from "@/ui/primitives/Badge";

import type { RoleName } from "@/lib/auth/roles";

const roleStyles: Record<RoleName, string> = {
  ADMIN: "admin-role-badge--admin",
  EDITOR: "admin-role-badge--editor",
  AUTHOR: "admin-role-badge--author",
  SUBSCRIBER: "admin-role-badge--subscriber",
};

const roleLabels: Record<RoleName, { en: string; hu: string }> = {
  ADMIN: { en: "Admin", hu: "Adminisztrátor" },
  EDITOR: { en: "Editor", hu: "Szerkesztő" },
  AUTHOR: { en: "Author", hu: "Szerző" },
  SUBSCRIBER: { en: "Subscriber", hu: "Feliratkozó" },
};

export function RoleBadge({ role }: { role: string }) {
  const locale = useAdminLocale();
  const supportedRole = role in roleStyles ? (role as RoleName) : null;

  return (
    <Badge
      className={
        supportedRole ? roleStyles[supportedRole] : "admin-role-badge--unknown"
      }
    >
      {supportedRole ? roleLabels[supportedRole][locale] : role}
    </Badge>
  );
}
