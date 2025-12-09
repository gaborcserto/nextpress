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
import Box from "@/ui/components/Box";
import { Button } from "@/ui/components/Buttons";
import Input from "@/ui/components/Input";
import StickyWrapper from "@/ui/components/StickyWrapper";
import UserAvatar from "@/ui/components/UserAvatar";
import Section from "@/ui/layout/Section";
import { showToast } from "@/ui/utils/toast";

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
   * (soft-lock / disable)
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
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold mb-1">Profile</h1>
        <p className="text-base-content/70">
          Update your display name and avatar.
        </p>
      </header>

      {isPending ? (
        <Box bare>
          <div className="p-6 animate-pulse space-y-3">
            <div className="h-8 w-2/3 bg-base-300 rounded" />
            <div className="h-40 bg-base-300 rounded" />
          </div>
        </Box>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6 max-w-5xl">
          {/* ------------------- Basic Info Section ------------------- */}
          <Section
            title="Basic info"
            desc="Set your display name and profile image."
          >
            <Box bare>
              <div className="flex flex-col md:flex-row items-center gap-6">
                <UserAvatar
                  name={values.name}
                  image={values.image}
                  size="lg"
                  className="ring-0"
                />

                <div className="flex-1 w-full max-w-md space-y-4">
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
              </div>
            </Box>
          </Section>

          {/* ------------------- Sticky footer buttons ------------------- */}
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

          {/* ------------------- Danger Zone ------------------- */}
          <Section
            title="Danger zone"
            desc="These actions affect your account security."
          >
            <Box bare className="flex items-center justify-end gap-3">
              {/* Deactivate = gray outline */}
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

              {/* Delete = red solid */}
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
        </form>
      )}
    </div>
  );
}
