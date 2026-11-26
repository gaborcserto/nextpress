"use client";

import { useState } from "react";
import { FaSave } from "react-icons/fa";

import { useSession } from "@/lib/auth/auth-client";
import { UserAvatar } from "@/ui/components";
import { AdminAsyncButton, Alert, Box, Section } from "@/ui/primitives";
import { AdminPageLayout } from "@/ui/shell";

import { DisplayNameForm } from "../DisplayNameForm";

export default function ProfileScreen() {
  const { data, isPending } = useSession();
  const [saving, setSaving] = useState(false);

  if (isPending) {
    return (
      <Box bare>
        <div
          className="p-6 animate-pulse space-y-3"
          role="status"
          aria-label="Loading profile"
        >
          <div className="h-8 w-2/3 bg-base-300 rounded" />
          <div className="h-40 bg-base-300 rounded" />
        </div>
      </Box>
    );
  }

  const user = data?.user;

  return (
    <AdminPageLayout
      title="Profile"
      workspace="focused"
      description="Manage your display name and review your account details."
      actions={
        user ? (
          <AdminAsyncButton
            type="submit"
            form="admin-profile-form"
            color="primary"
            loading={saving}
            icon={FaSave}
          >
            Save profile
          </AdminAsyncButton>
        ) : undefined
      }
    >
      <Section
        title="Account"
        desc="Update the display name shown in the Admin."
      >
        {user ? (
          <div className="admin-profile-layout">
            <div className="grid justify-items-start gap-3 rounded-(--radius-control) bg-(--surface-rail) p-4 wrap-anywhere">
              <UserAvatar
                name={user.name}
                image={user.image}
                size="lg"
                className="shrink-0"
              />
              <dl className="text-sm">
                <dt className="text-(--text-muted)">Email</dt>
                <dd className="font-medium">{user.email}</dd>
              </dl>
            </div>
            <DisplayNameForm
              key={user.id}
              initialName={user.name ?? ""}
              onSavingChangeAction={setSaving}
            />
          </div>
        ) : (
          <Alert status="error" message="Unable to load your profile." />
        )}
      </Section>
    </AdminPageLayout>
  );
}
