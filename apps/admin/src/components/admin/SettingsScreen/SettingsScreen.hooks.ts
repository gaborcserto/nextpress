"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  ProviderCredentialUpdates,
  SettingsApiPayload,
  SettingsApiResponse,
  SettingsFormValues,
  SettingsScreenState,
} from "./SettingsScreen.types";
import type { RoleName } from "@/lib/auth/roles";

async function api<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { ...init, cache: "no-store" });
  if (!response.ok) {
    const message = await response.text().catch(() => "Request failed");
    throw new Error(message);
  }
  return (await response.json()) as T;
}

function normalizeForm(
  data: Partial<SettingsApiResponse> | null | undefined,
  fallbackRole: RoleName,
): SettingsFormValues {
  return {
    siteName: data?.siteName ?? "",
    siteDescription: data?.siteDescription ?? "",
    siteUrl: data?.siteUrl ?? "",
    ogImageUrl: data?.ogImageUrl ?? "",
    defaultUserRole: data?.defaultUserRole ?? fallbackRole,
    oauthProviders: data?.oauthProviders ?? [],
  };
}

function buildPayload(
  form: SettingsFormValues,
  credentials: ProviderCredentialUpdates,
): SettingsApiPayload {
  return {
    siteName: form.siteName,
    siteDescription: form.siteDescription,
    siteUrl: form.siteUrl,
    ogImageUrl: form.ogImageUrl,
    defaultUserRole: form.defaultUserRole,
    oauthProviders: form.oauthProviders.map((provider) => ({
      provider: provider.provider,
      enabled: provider.enabled,
      clientId: provider.clientId,
      ...credentials[provider.provider],
    })),
  };
}

export function useSettingsScreen(fallbackRole: RoleName): SettingsScreenState {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SettingsFormValues>(() =>
    normalizeForm(undefined, fallbackRole),
  );
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<SettingsApiResponse>("/api/admin/settings");
      setForm(normalizeForm(data, fallbackRole));
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
      try {
        await api("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(form, credentials)),
        });
        await load();
        return true;
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
    save,
  };
}
