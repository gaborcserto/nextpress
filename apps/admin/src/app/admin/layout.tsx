import { PublicSiteSettingsSchema } from "@nextpress/shared/api-contracts";
import { DEFAULT_SITE_DATE_TIME } from "@nextpress/shared/site-date-time";
import { redirect } from "next/navigation";

import { apiOrigin } from "@/lib/api/upstream.server";
import { getSessionWithRole } from "@/lib/auth/session.server";
import { AdminDateTimeProvider } from "@/lib/settings/admin-date-time";
import { AppShell } from "@/ui/shell";

import type { ReactNode } from "react";

async function getAdminDateTime() {
  try {
    const response = await fetch(`${apiOrigin()}/api/public/settings`, {
      cache: "no-store",
    });

    if (response.ok) {
      const settings = PublicSiteSettingsSchema.parse(await response.json());

      return settings.dateTime ?? DEFAULT_SITE_DATE_TIME;
    }
  } catch {
    // Keep the shell available while preventing edits in an unknown timezone.
  }

  return null;
}

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSessionWithRole();

  if (!session?.user?.id) {
    redirect("/auth/sign-in?callbackUrl=%2Fadmin");
  }

  const role = session.user.role;
  const dateTime = await getAdminDateTime();

  return (
    <AdminDateTimeProvider settings={dateTime}>
      <AppShell role={role} accountName={session.user.name}>
        {children}
      </AppShell>
    </AdminDateTimeProvider>
  );
}
