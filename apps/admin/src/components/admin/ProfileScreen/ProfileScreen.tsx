"use client";

import {
  displayNameSchema,
  MAX_DISPLAY_NAME_LENGTH,
} from "@nextpress/shared/auth-policy";
import { useState, type FormEvent } from "react";
import { FaSave } from "react-icons/fa";

import { authClient, useSession } from "@/lib/auth/auth-client";
import { UserAvatar } from "@/ui/components";
import { Alert, Box, Button, Input, Section } from "@/ui/primitives";
import { AdminPageLayout } from "@/ui/shell";

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
          <Button
            type="submit"
            form="admin-profile-form"
            color="primary"
            loading={saving}
          >
            <FaSave aria-hidden="true" />
            Save profile
          </Button>
        ) : undefined
      }
    >
      <Section title="Account">
        {user ? (
          <div className="admin-profile-layout">
            <div className="space-y-3 wrap-anywhere">
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

function DisplayNameForm({
  initialName,
  onSavingChangeAction,
}: {
  initialName: string;
  onSavingChangeAction: (saving: boolean) => void;
}) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string>();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setSaveError(null);
    setSaved(false);
    const parsed = displayNameSchema.safeParse(name);

    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);

      return;
    }

    setSaving(true);
    onSavingChangeAction(true);

    try {
      const { error } = await authClient.updateUser({ name: parsed.data });

      if (error) {
        throw new Error("Profile update rejected");
      }

      setName(parsed.data);
      setSaved(true);
    } catch {
      setSaveError(
        "Unable to save your profile. Check your session and try again.",
      );
    } finally {
      setSaving(false);
      onSavingChangeAction(false);
    }
  }

  return (
    <form
      id="admin-profile-form"
      className="min-w-0 space-y-3"
      onSubmit={(event) => void saveProfile(event)}
    >
      <Input
        autoComplete="nickname"
        disabled={saving}
        error={fieldError}
        label="Display name"
        maxLength={MAX_DISPLAY_NAME_LENGTH}
        onChange={(event) => {
          setName(event.target.value);
          setFieldError(undefined);
          setSaved(false);
        }}
        value={name}
      />
      <Alert status="error" message={saveError} />
      <p role="status">{saved ? "Profile saved." : ""}</p>
    </form>
  );
}
