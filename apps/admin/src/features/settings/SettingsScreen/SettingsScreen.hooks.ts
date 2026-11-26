"use client";

import { type Appearance } from "@nextpress/shared";
import {
  SettingsResponseSchema,
  SettingsSavedSchema,
} from "@nextpress/shared/settings-contracts";
import { DEFAULT_SITE_DATE_TIME } from "@nextpress/shared/site-date-time";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { jsonFetcher } from "@/lib/api";

import { buildSettingsPayload, normalizeSettingsForm } from "../admin-settings";

import type { RoleName } from "@/lib/auth/roles";

import type {
  ProviderCredentialUpdates,
  SettingsFormValues,
  SettingsScreenState,
} from "./SettingsScreen.types";

export function useSettingsScreen(fallbackRole: RoleName): SettingsScreenState {
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const loadContext = useMemo(() => ({ fallbackRole }), [fallbackRole]);
  const [settledContext, setSettledContext] = useState<
    typeof loadContext | null
  >(null);
  const loading = settledContext !== loadContext;
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SettingsFormValues>(() =>
    normalizeSettingsForm(undefined, fallbackRole),
  );

  const [savedForm, setSavedForm] = useState<SettingsFormValues | null>(null);

  const load = useCallback(() => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;

    return jsonFetcher<unknown>("/api/admin/settings", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (controller.signal.aborted) {
          return;
        }

        const data = SettingsResponseSchema.parse(response);
        setLoadError(null);

        if (!loadedRef.current) {
          const initial = normalizeSettingsForm(data, loadContext.fallbackRole);
          setForm(initial);
          setSavedForm(initial);
          loadedRef.current = true;
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadError("Unable to load settings. Please try again.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setSettledContext(loadContext);
        }
      });
  }, [loadContext]);

  const retry = async () => {
    setSettledContext(null);
    setLoadError(null);
    await load();
  };

  useEffect(() => {
    void load();

    return () => request.current?.abort();
  }, [load]);

  const save = useCallback(
    async (credentials: ProviderCredentialUpdates, appearance?: Appearance) => {
      if (savingRef.current || !loadedRef.current || loading || loadError) {
        return false;
      }

      savingRef.current = true;
      setSaving(true);
      setError(null);

      try {
        const response = await jsonFetcher<unknown>("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildSettingsPayload(form, credentials, appearance),
          ),
        });

        const saved = SettingsSavedSchema.parse(response);
        const statusByProvider = new Map(
          saved.oauthProviders.map((status) => [status.provider, status]),
        );

        const withProviderStatuses = (current: SettingsFormValues) => ({
          ...current,
          oauthProviders: current.oauthProviders.map((provider) => ({
            ...provider,
            ...statusByProvider.get(provider.provider),
          })),
        });

        setForm(withProviderStatuses);
        setSavedForm(withProviderStatuses(form));

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
    [form, loading, loadError],
  );

  return {
    form,
    savedDateTime: savedForm?.dateTime ?? DEFAULT_SITE_DATE_TIME,
    dirty:
      savedForm !== null && JSON.stringify(savedForm) !== JSON.stringify(form),
    setForm,
    loaded,
    loadError: loading ? null : loadError,
    retry,
    loading,
    saving,
    error,
    save,
  };
}
