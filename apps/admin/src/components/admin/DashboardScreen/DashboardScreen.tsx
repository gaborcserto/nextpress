"use client";

import { useSession } from "@/lib/auth/auth-client";

export default function DashboardScreen() {
  const { data, isPending } = useSession();
  const displayName = data?.user?.name || data?.user?.email || "Admin";

  return (
    <div className="p-6 space-y-2">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-base-content/70" aria-live="polite">
        {isPending ? "Loading your account..." : `Welcome, ${displayName}.`}
      </p>
    </div>
  );
}
