"use client";

import { PostListingModeSchema, PostsPerPageSchema } from "@nextpress/shared";
import {
  DEFAULT_SITE_DATE_TIME,
  SiteDateTimeSchema,
} from "@nextpress/shared/site-date-time";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { FaSave } from "react-icons/fa";
import { FiChevronDown } from "react-icons/fi";

import { ROLES, type RoleName } from "@/lib/auth/roles";
import { DataListLoading } from "@/ui/components/DataList";
import {
  Button,
  Alert,
  Field,
  FormGrid12,
  Input,
  Section,
  Select,
  Toggle,
} from "@/ui/primitives";
import { Badge } from "@/ui/primitives/Badge";
import { AdminPageLayout } from "@/ui/shell/AdminPageLayout";
import { showToast } from "@/ui/utils";

import AppearanceSettings from "./AppearanceSettings";
import { DateTimeSettings } from "./DateTimeSettings";
import { useSettingsScreen } from "./SettingsScreen.hooks";
import {
  selectSettingsSection,
  SettingsPanel,
  SettingsTabs,
  useSettingsSection,
} from "./SettingsTabs";

import type { OAuthProviderName } from "@/lib/auth/oauth-providers";

import type {
  ProviderCredentialUpdates,
  SettingsFormValues,
} from "./SettingsScreen.types";

const ROLE_OPTIONS = ROLES.map((role) => ({ value: role, label: role }));
const POST_LISTING_MODE_OPTIONS = [
  { value: "PAGINATION", label: "Pagination" },
  { value: "LOAD_MORE", label: "Load more" },
] as const;

function updateProviderAtIndex(
  previous: SettingsFormValues,
  index: number,
  patch: Partial<SettingsFormValues["oauthProviders"][number]>,
): SettingsFormValues {
  const oauthProviders = [...previous.oauthProviders];
  oauthProviders[index] = { ...oauthProviders[index], ...patch };

  return { ...previous, oauthProviders };
}

function readCredentialUpdates(
  form: HTMLFormElement,
  providers: readonly OAuthProviderName[],
) {
  const data = new FormData(form);
  const updates: ProviderCredentialUpdates = {};

  for (const provider of providers) {
    const clientSecret = data.get(`clientSecret:${provider}`);
    const update = {
      ...(typeof clientSecret === "string" && clientSecret
        ? { clientSecret }
        : {}),
    };

    if (Object.keys(update).length) {
      updates[provider] = update;
    }
  }

  return updates;
}

export default function SettingsScreen({
  timeZones = ["UTC"],
}: {
  timeZones?: readonly string[];
}) {
  const router = useRouter();
  const activeSection = useSettingsSection();
  const credentialForm = useRef<HTMLFormElement>(null);
  const [credentialsDirty, setCredentialsDirty] = useState(false);
  const {
    form,
    setForm,
    loading,
    saving,
    error,
    save,
    loaded,
    loadError,
    savedDateTime,
    dirty,
    retry,
  } = useSettingsScreen("SUBSCRIBER");
  const dateTime = form.dateTime ?? DEFAULT_SITE_DATE_TIME;
  const dateTimeDirty =
    JSON.stringify(dateTime) !== JSON.stringify(savedDateTime);

  useEffect(() => {
    if (!dateTimeDirty) {
      return;
    }

    function preventLeaving(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = true;
    }

    window.addEventListener("beforeunload", preventLeaving);

    return () => window.removeEventListener("beforeunload", preventLeaving);
  }, [dateTimeDirty]);

  const postsPerPageError = PostsPerPageSchema.safeParse(form.postsPerPage)
    .success
    ? undefined
    : "Enter a whole number from 1 to 50.";

  useEffect(() => {
    function scrollToLegacyAppearance() {
      if (
        !loaded ||
        activeSection !== "settings-general" ||
        window.location.hash !== "#settings-appearance"
      ) {
        return;
      }

      document
        .getElementById("settings-appearance")
        ?.scrollIntoView?.({ block: "start" });
    }

    scrollToLegacyAppearance();
    window.addEventListener("hashchange", scrollToLegacyAppearance);
    window.addEventListener("popstate", scrollToLegacyAppearance);

    return () => {
      window.removeEventListener("hashchange", scrollToLegacyAppearance);
      window.removeEventListener("popstate", scrollToLegacyAppearance);
    };
  }, [activeSection, loaded]);

  function updateCredentialsDirty(event: FormEvent<HTMLFormElement>) {
    if (
      event.target instanceof HTMLInputElement &&
      event.target.type === "password"
    ) {
      const updates = readCredentialUpdates(
        event.currentTarget,
        form.oauthProviders.map(({ provider }) => provider),
      );
      setCredentialsDirty(Object.keys(updates).length > 0);
    }
  }

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!credentialForm.current || saving) {
      return;
    }

    if (!SiteDateTimeSchema.safeParse(dateTime).success) {
      flushSync(() => selectSettingsSection("settings-general"));
      document.getElementById("site-time-zone")?.focus();

      return;
    }

    // Mounted controls in inactive panels still participate in the shared save.
    const invalidInput = Array.from(credentialForm.current.elements).find(
      (control) =>
        control instanceof HTMLInputElement &&
        control.willValidate &&
        !control.validity.valid,
    );

    if (invalidInput instanceof HTMLInputElement) {
      const panel = invalidInput.closest('[role="tabpanel"]');

      if (panel) {
        flushSync(() => selectSettingsSection(panel.id));
      }

      invalidInput.reportValidity();

      return;
    }

    const credentials = readCredentialUpdates(
      credentialForm.current,
      form.oauthProviders.map((provider) => provider.provider),
    );

    if (await save(credentials)) {
      for (const [provider, submitted] of Object.entries(credentials)) {
        const input = credentialForm.current?.elements.namedItem(
          `clientSecret:${provider}`,
        );

        if (
          input instanceof HTMLInputElement &&
          input.value === submitted.clientSecret
        ) {
          input.value = "";
        }
      }

      const formElement = credentialForm.current;

      if (formElement) {
        const remaining = readCredentialUpdates(
          formElement,
          form.oauthProviders.map(({ provider }) => provider),
        );
        setCredentialsDirty(Object.keys(remaining).length > 0);
      }

      router.refresh();
      showToast("Settings saved.", "success");
    }
  };

  if (loading && !loaded) {
    return (
      <AdminPageLayout title="Settings" workspace="settings">
        <DataListLoading label="settings" />
      </AdminPageLayout>
    );
  }

  if (!loaded) {
    return (
      <AdminPageLayout title="Settings" workspace="settings">
        <Alert
          message={loadError ?? "Settings have not loaded."}
          status="error"
        />
        <Button onClick={() => void retry()}>Retry</Button>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title="Settings"
      workspace="settings"
      description="Manage site metadata, publishing, sign-in, and website appearance."
      actions={
        <Button
          type="submit"
          form="admin-settings-form"
          color="primary"
          loading={saving}
          disabled={loading || !!loadError}
          aria-describedby="settings-save-scope"
        >
          <FaSave aria-hidden="true" />
          <span className="min-w-0">Save site settings</span>
        </Button>
      }
    >
      <div className="admin-settings-workspace">
        <SettingsTabs active={activeSection} />
        <div className="admin-settings-layout">
          <form
            id="admin-settings-form"
            ref={credentialForm}
            noValidate
            onChange={updateCredentialsDirty}
            onSubmit={(event) => void saveSettings(event)}
            className="space-y-6"
          >
            <Alert message={loadError} status="error" />
            {loadError && (
              <Button loading={loading} onClick={() => void retry()}>
                Retry loading settings
              </Button>
            )}
            <Alert message={error} status="error" />
            <SettingsPanel
              id="settings-general"
              active={activeSection}
              className="admin-settings-general"
            >
              <fieldset disabled={saving} className="min-w-0">
                <Section
                  title="Site information"
                  desc="Basic metadata used across the site."
                >
                  <div className="admin-settings-field-grid">
                    <div>
                      <Field label="Site name" htmlFor="site-name">
                        <Input
                          id="site-name"
                          fullWidth
                          required
                          maxLength={200}
                          value={form.siteName}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              siteName: event.target.value,
                            }))
                          }
                        />
                      </Field>
                    </div>

                    <div>
                      <Field label="Description" htmlFor="site-description">
                        <Input
                          id="site-description"
                          fullWidth
                          maxLength={1000}
                          value={form.siteDescription}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              siteDescription: event.target.value,
                            }))
                          }
                        />
                      </Field>
                    </div>

                    <div>
                      <Field
                        label="Site URL"
                        htmlFor="site-url"
                        hint="Used for canonical URLs."
                      >
                        <Input
                          id="site-url"
                          type="url"
                          fullWidth
                          maxLength={2000}
                          value={form.siteUrl}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              siteUrl: event.target.value,
                            }))
                          }
                        />
                      </Field>
                    </div>

                    <div>
                      <Field
                        label="Default OG image URL"
                        htmlFor="og-image-url"
                      >
                        <Input
                          id="og-image-url"
                          type="url"
                          fullWidth
                          maxLength={2000}
                          value={form.ogImageUrl}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              ogImageUrl: event.target.value,
                            }))
                          }
                        />
                      </Field>
                    </div>
                  </div>
                </Section>
                <DateTimeSettings
                  value={dateTime}
                  timeZones={timeZones}
                  dirty={dateTimeDirty}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, dateTime: value }))
                  }
                  onCancel={() =>
                    setForm((current) => ({
                      ...current,
                      dateTime: savedDateTime,
                    }))
                  }
                />
              </fieldset>
              <div
                id="settings-appearance"
                className="admin-settings-appearance-anchor"
              >
                <AppearanceSettings />
              </div>
            </SettingsPanel>
            <fieldset disabled={saving} className="grid min-w-0 gap-6">
              <SettingsPanel id="settings-publishing" active={activeSection}>
                <Section
                  title="Publishing"
                  desc="Choose how public post lists are navigated."
                >
                  <div className="admin-settings-field-grid">
                    <div>
                      <Field label="Listing mode" htmlFor="post-listing-mode">
                        <Select
                          id="post-listing-mode"
                          fullWidth
                          value={form.postListingMode}
                          options={POST_LISTING_MODE_OPTIONS}
                          onChangeAction={(value) => {
                            const parsed =
                              PostListingModeSchema.safeParse(value);

                            if (parsed.success) {
                              setForm((current) => ({
                                ...current,
                                postListingMode: parsed.data,
                              }));
                            }
                          }}
                        />
                      </Field>
                    </div>
                    <div>
                      <Field
                        label="Posts per page / batch"
                        htmlFor="posts-per-page"
                      >
                        <Input
                          id="posts-per-page"
                          type="number"
                          fullWidth
                          required
                          min={1}
                          max={50}
                          step={1}
                          hint="Applies to both pagination pages and Load more batches."
                          error={postsPerPageError}
                          value={form.postsPerPage}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              postsPerPage:
                                event.target.value === ""
                                  ? ""
                                  : event.target.valueAsNumber,
                            }))
                          }
                        />
                      </Field>
                    </div>
                  </div>
                </Section>
              </SettingsPanel>
              <SettingsPanel
                id="settings-authentication"
                active={activeSection}
                className="space-y-6"
              >
                <Section
                  title="Account defaults"
                  desc="Defaults for users created by an administrator. Public signup always receives SUBSCRIBER."
                >
                  <FormGrid12>
                    <Field
                      label="Default user role"
                      htmlFor="default-user-role"
                      span={12}
                    >
                      <Select
                        id="default-user-role"
                        fullWidth
                        value={form.defaultUserRole}
                        options={ROLE_OPTIONS}
                        onChangeAction={(value) =>
                          setForm((current) => ({
                            ...current,
                            defaultUserRole: value as RoleName,
                          }))
                        }
                      />
                    </Field>
                  </FormGrid12>
                </Section>

                <Section
                  title="OAuth providers"
                  desc="Only enabled providers with complete credentials are available for sign-in. Environment credentials are used when stored values are blank."
                >
                  <div className="admin-provider-list">
                    {form.oauthProviders.length ? (
                      form.oauthProviders.map((provider, index) => {
                        const configured =
                          provider.hasClientId && provider.hasClientSecret;

                        return (
                          <details
                            key={provider.provider}
                            className="admin-provider"
                          >
                            <summary>
                              <span className="font-semibold capitalize">
                                {provider.provider}
                              </span>
                              <span className="admin-provider-status">
                                <span>
                                  {configured
                                    ? "Configured"
                                    : "Credentials required"}
                                </span>
                                <Badge
                                  className={
                                    provider.enabled
                                      ? undefined
                                      : "admin-badge-muted"
                                  }
                                >
                                  {provider.enabled ? "Enabled" : "Disabled"}
                                </Badge>
                              </span>
                              <FiChevronDown aria-hidden="true" />
                            </summary>
                            <fieldset className="admin-provider-fields">
                              <Toggle
                                aria-label={`Enable ${provider.provider}`}
                                checked={provider.enabled}
                                onChangeAction={(enabled) =>
                                  setForm((current) =>
                                    updateProviderAtIndex(current, index, {
                                      enabled,
                                    }),
                                  )
                                }
                                inlineLabel="Allow sign-in"
                              />
                              <Input
                                label={`${provider.provider} client ID`}
                                fullWidth
                                maxLength={2000}
                                value={provider.clientId}
                                placeholder={
                                  provider.hasClientId ? "Configured value" : ""
                                }
                                onChange={(event) =>
                                  setForm((current) =>
                                    updateProviderAtIndex(current, index, {
                                      clientId: event.target.value,
                                    }),
                                  )
                                }
                              />
                              <Field
                                label={`${provider.provider} new secret`}
                                htmlFor={`oauth-${provider.provider}-secret`}
                              >
                                <input
                                  id={`oauth-${provider.provider}-secret`}
                                  className="input w-full max-w-full"
                                  type="password"
                                  maxLength={10000}
                                  name={`clientSecret:${provider.provider}`}
                                  autoComplete="new-password"
                                  placeholder={
                                    provider.hasClientSecret
                                      ? "Configured value preserved"
                                      : "Required"
                                  }
                                />
                              </Field>
                            </fieldset>
                          </details>
                        );
                      })
                    ) : (
                      <p className="text-sm text-(--text-muted)">
                        No OAuth providers configured.
                      </p>
                    )}
                  </div>
                </Section>
              </SettingsPanel>
              <div className="admin-settings-save">
                <p
                  role="status"
                  className="text-sm font-medium text-(--text-muted)"
                >
                  {saving
                    ? "Saving site settings..."
                    : dirty || credentialsDirty
                      ? "Unsaved site settings"
                      : ""}
                </p>
                <p
                  id="settings-save-scope"
                  className="text-sm text-(--text-muted)"
                >
                  Saves Site information, Publishing, and Authentication
                  settings.
                </p>
              </div>
            </fieldset>
          </form>
        </div>
      </div>
    </AdminPageLayout>
  );
}
