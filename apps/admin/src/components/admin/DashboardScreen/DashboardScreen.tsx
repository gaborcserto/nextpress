"use client";

import { useSession } from "@/lib/auth/auth-client";
import { AdminPageLayout } from "@/ui/shell";

export default function DashboardScreen() {
  const { data, isPending } = useSession();
  const displayName = data?.user?.name || data?.user?.email || "Admin";

  return (
    <AdminPageLayout title="Dashboard">
      <p className="text-base-content/70" aria-live="polite">
        {isPending ? "Loading your account..." : `Welcome, ${displayName}.`}
      </p>
    </AdminPageLayout>
  );
}
