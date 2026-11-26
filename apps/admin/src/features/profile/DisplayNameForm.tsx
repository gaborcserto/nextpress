"use client";

import {
  displayNameSchema,
  MAX_DISPLAY_NAME_LENGTH,
} from "@nextpress/shared/auth-policy";
import { useState, type FormEvent } from "react";

import { authClient } from "@/lib/auth/auth-client";
import { Alert, Input } from "@/ui/primitives";

export function DisplayNameForm({
  initialName,
  onSavingChangeAction,
  onSavedAction,
}: {
  initialName: string;
  onSavingChangeAction: (saving: boolean) => void;
  onSavedAction?: (name: string) => void;
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
      onSavedAction?.(parsed.data);
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
      className="min-w-0 space-y-4"
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
      <p role="status" className="text-sm text-(--status-success-text)">
        {saved ? "Profile saved." : ""}
      </p>
    </form>
  );
}
