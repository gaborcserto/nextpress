"use client";

import { useSession } from "@/lib/auth/auth-client";
import { UserAvatar } from "@/ui/components";
import { Alert, Box, Section } from "@/ui/primitives";
import { AdminPageLayout } from "@/ui/shell";

export default function ProfileScreen() {
  const { data, isPending } = useSession();

  if (isPending) {
    return (
      <Box bare>
        <div className="p-6 animate-pulse space-y-3" aria-label="Loading profile">
          <div className="h-8 w-2/3 bg-base-300 rounded" />
          <div className="h-40 bg-base-300 rounded" />
        </div>
      </Box>
    );
  }

  const user = data?.user;
  const name = user?.name || "Unnamed user";

  return (
    <AdminPageLayout title="Profile" description="Review your current account details.">
      <Alert
        status="info"
        message="Profile editing and account management are not available in the admin yet. Your account details continue to be managed by the configured sign-in provider."
      />

      <Section title="Account" desc="Details from your current session.">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <UserAvatar
            name={user?.name}
            image={user?.image}
            size="lg"
            className="ring-0"
          />

          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-base-content/60">Display name</dt>
              <dd className="font-medium">{name}</dd>
            </div>
            <div>
              <dt className="text-base-content/60">Email</dt>
              <dd className="font-medium">{user?.email || "Not available"}</dd>
            </div>
          </dl>
        </div>
      </Section>
    </AdminPageLayout>
  );
}
