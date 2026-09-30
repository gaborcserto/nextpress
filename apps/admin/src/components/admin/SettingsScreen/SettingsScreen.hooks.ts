"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  ProviderCredentialUpdates,
  SettingsApiResponse,
  SettingsFormValues,
  SettingsScreenState,
} from "./SettingsScreen.types";
import { jsonFetcher } from "@/lib/api";
import type { RoleName } from "@/lib/auth/roles";
import {
  buildSettingsPayload,
  normalizeSettingsForm,
} from "@/lib/settings/admin-settings";

export function useSettingsScreen(fallbackRole: RoleName): SettingsScreenState {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SettingsFormValues>(() =>
    normalizeSettingsForm(undefined, fallbackRole),
  );
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await jsonFetcher<SettingsApiResponse>("/api/admin/settings", {
        cache: "no-store",
      });
      setForm(normalizeSettingsForm(data, fallbackRole));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, [fallbackRole]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (credentials: ProviderCredentialUpdates) => {
      setSaving(true);
      setError(null);
      try {
        await jsonFetcher("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildSettingsPayload(form, credentials)),
        });
        await load();
        return true;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Failed to save settings.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [form, load],
  );

  return {
    form,
    setForm,
    loading,
    saving,
    error,
    save,
  };
}
