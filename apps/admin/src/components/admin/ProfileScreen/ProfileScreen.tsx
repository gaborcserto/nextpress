"use client";

import { useEffect, useState } from "react";

import type {
  ProfileFormValues,
  UserWithProfileImage,
  ProfileInputChangeEvent,
  ProfileFormEvent,
} from "./ProfileScreen.types";
import { apiFetch } from "@/lib/api";
import { useSession } from "@/lib/auth/auth-client";
import { UserAvatar } from "@/ui/components";
import {
  Box,
  Button,
  Input,
  StickyWrapper,
  Section,
} from "@/ui/primitives";
import { showToast } from "@/ui/utils";

export default function ProfileScreen() {
  const { data, isPending, refetch } = useSession();

  const [values, setValues] = useState<ProfileFormValues>({
    name: "",
    image: "",
  });

  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* --------------------------------------------------
   * Load initial user data
   * -------------------------------------------------- */
  useEffect(() => {
    if (data?.user) {
      const user = data.user as UserWithProfileImage;

      setValues({
        name: user.name ?? "",
        image: user.image ?? "",
      });
    }
  }, [data?.user, data?.user?.id]);

  /* --------------------------------------------------
   * Handle input changes
   * -------------------------------------------------- */
  const onChange =
    (key: keyof ProfileFormValues) =>
      (e: ProfileInputChangeEvent) => {
        setValues((prev) => ({ ...prev, [key]: e.target.value }));
      };

  /* --------------------------------------------------
   * Save profile
   * -------------------------------------------------- */
  const onSubmit = async (e?: ProfileFormEvent) => {
    e?.preventDefault();
    setSaving(true);

    try {
      const res = await apiFetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        showToast(`Save failed: ${res.status}`, "error");
        return;
      }

      showToast("Profile saved.", "success");
      refetch?.();
    } catch {
      showToast("Unexpected error while saving.", "error");
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------------------------------
   * Deactivate account
   * -------------------------------------------------- */
  const handleDeactivate = async () => {
    if (!confirm("Are you sure you want to deactivate your account?")) return;
    setDeactivating(true);

    try {
      const res = await apiFetch("/api/profile/deactivate", { method: "POST" });
      if (!res.ok) {
        showToast("Deactivate failed.", "error");
        return;
      }
      showToast("Account deactivated.", "success");
    } finally {
      setDeactivating(false);
    }
  };

  /* --------------------------------------------------
   * Delete account (permanent)
   * -------------------------------------------------- */
  const handleDelete = async () => {
    if (!confirm("This action is permanent. Delete account?")) return;
    setDeleting(true);

    try {
      const res = await apiFetch("/api/profile/delete", { method: "DELETE" });
      if (!res.ok) {
        showToast("Delete failed.", "error");
        return;
      }
      showToast("Account deleted.", "success");
      // Optional: redirect or logout
    } finally {
      setDeleting(false);
    }
  };

  /* --------------------------------------------------
   * Render
   * -------------------------------------------------- */
  return (
    <div className="space-y-6 w-full">
      {isPending ? (
        <Box bare>
          <div className="p-6 animate-pulse space-y-3">
            <div className="h-8 w-2/3 bg-base-300 rounded" />
            <div className="h-40 bg-base-300 rounded" />
          </div>
        </Box>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6 w-full">
          <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-12 items-start">
            <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-6 self-start">
              <header className="h-20 flex flex-col justify-center space-y-1">
                <h1 className="text-2xl font-semibold">Profile</h1>
                <p className="text-base-content/70">
                  Update your display name and avatar.
                </p>
              </header>

              <Section title="Avatar" desc="Preview your profile picture.">
                <Box bare>
                  <div className="flex items-center gap-4">
                    <UserAvatar
                      name={values.name}
                      image={values.image}
                      size="lg"
                      className="ring-0"
                    />

                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {values.name || "Unnamed user"}
                      </div>
                      <div className="text-sm text-base-content/70">
                        Shown across the admin UI.
                      </div>
                    </div>
                  </div>
                </Box>
              </Section>

              <Section
                title="Danger zone"
                desc="These actions affect your account security."
              >
                <Box bare className="flex flex-col gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    color="default"
                    loading={deactivating}
                    onClick={handleDeactivate}
                    className="justify-start"
                  >
                    Deactivate account
                  </Button>

                  <Button
                    type="button"
                    variant="solid"
                    color="error"
                    loading={deleting}
                    onClick={handleDelete}
                    className="justify-start"
                  >
                    Delete account
                  </Button>
                </Box>
              </Section>
            </aside>

            <main className="lg:col-span-8 space-y-6 min-w-0 lg:pt-26">
              <Section
                title="Basic info"
                desc="Set your display name and profile image."
              >
                <Box bare>
                  <div className="space-y-4 max-w-xl">
                    <Input
                      label="Display name"
                      value={values.name}
                      onChange={onChange("name")}
                      placeholder="Your name"
                      fullWidth
                      rounded="lg"
                    />

                    <Input
                      label="Avatar URL"
                      type="url"
                      value={values.image}
                      onChange={onChange("image")}
                      placeholder="https://…"
                      fullWidth
                      rounded="lg"
                    />
                  </div>
                </Box>
              </Section>

              <StickyWrapper>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => history.back()}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  color="primary"
                  variant="solid"
                  loading={saving}
                >
                  Save
                </Button>
              </StickyWrapper>
            </main>
          </div>
        </form>
      )}
    </div>
  );
}
