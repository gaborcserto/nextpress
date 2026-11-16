"use client";

import { PostListingModeSchema, PostsPerPageSchema } from "@nextpress/shared";
import { OAUTH_PROVIDERS } from "@nextpress/shared/oauth-providers";
import { ROLES } from "@nextpress/shared/roles";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import { jsonFetcher } from "@/lib/api";
import {
  buildSettingsPayload,
  normalizeSettingsForm,
} from "@/lib/settings/admin-settings";

import type { RoleName } from "@/lib/auth/roles";

import type {
  ProviderCredentialUpdates,
  SettingsFormValues,
  SettingsScreenState,
} from "./SettingsScreen.types";

// Reject incomplete authoritative responses instead of normalizing them into writable defaults.
const settingsResponseSchema = z.object({
  siteName: z.string(),
  siteDescription: z.string(),
  siteUrl: z.string(),
  ogImageUrl: z.string(),
  defaultUserRole: z.enum(ROLES),
  postListingMode: PostListingModeSchema,
  postsPerPage: PostsPerPageSchema,
  oauthProviders: z.array(
    z.object({
      provider: z.enum(OAUTH_PROVIDERS),
      enabled: z.boolean(),
      clientId: z.string(),
      hasClientId: z.boolean(),
      hasClientSecret: z.boolean(),
      operational: z.boolean(),
    }),
  ),
});

export function useSettingsScreen(fallbackRole: RoleName): SettingsScreenState {
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const request = useRef(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SettingsFormValues>(() =>
    normalizeSettingsForm(undefined, fallbackRole),
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const requestId = ++request.current;

    try {
      const response = await jsonFetcher<unknown>("/api/admin/settings", {
        cache: "no-store",
      });
      const data = settingsResponseSchema.parse(response);

      if (request.current !== requestId) {
        return;
      }
      if (!loadedRef.current) {
        setForm(normalizeSettingsForm(data, fallbackRole));
        loadedRef.current = true;
        setLoaded(true);
      }
    } catch {
      if (request.current === requestId) {
        setLoadError("Unable to load settings. Please try again.");
      }
    } finally {
      if (request.current === requestId) {
        setLoading(false);
      }
    }
  }, [fallbackRole]);

  useEffect(() => {
    void load();

    return () => {
      request.current += 1;
    };
  }, [load]);

  const save = useCallback(
    async (credentials: ProviderCredentialUpdates) => {
      if (savingRef.current || !loadedRef.current || loading) {
        return false;
      }
      savingRef.current = true;
      setSaving(true);
      setError(null);

      try {
        await jsonFetcher("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildSettingsPayload(form, credentials)),
        });
        setForm((current) => ({
          ...current,
          oauthProviders: current.oauthProviders.map((provider) => ({
            ...provider,
            hasClientSecret:
              provider.hasClientSecret ||
              Boolean(credentials[provider.provider]?.clientSecret),
          })),
        }));

        return true;
      } catch {
        setError(
          "Unable to save settings. Your edits are preserved. Please try again.",
        );

        return false;
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [form, loading],
  );

  return {
    form,
    setForm,
    loaded,
    loadError,
    retry: load,
    loading,
    saving,
    error,
    save,
  };
}
