"use client";

import { useSession } from "@/lib/auth/auth-client";
import { Box, SkeletonBox } from "@/ui/primitives";

export default function DashboardScreen() {
  const { data, isPending } = useSession();

  const displayName =
      data?.user?.name || data?.user?.email || "Admin";

  return (
      <div className="p-6 space-y-6">
        <header>
          <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
          <p className="text-base-content/70">
            Welcome, {displayName} 👋
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {isPending
              ? [...Array(3)].map((_, i) => <SkeletonBox key={i} />)
              : [...Array(3)].map((_, i) => <SkeletonBox key={i} />)}
        </div>

        <Box className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Example Widget</h2>
          <p className="text-sm text-base-content/70">
            This is where your actual dashboard widgets will go.
          </p>
        </Box>
      </div>
  );
}
