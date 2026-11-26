"use client";

import {
  PostListingModeSchema,
  PostsPerPageSchema,
  type Appearance,
} from "@nextpress/shared";
import {
  DEFAULT_SITE_DATE_TIME,
  SiteDateTimeSchema,
} from "@nextpress/shared/site-date-time";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { flushSync } from "react-dom";
import { FaSave } from "react-icons/fa";
import { FiChevronDown } from "react-icons/fi";

import { ROLES, type RoleName } from "@/lib/auth/roles";
import { DataListLoading } from "@/ui/components/DataList";
import {
  AdminAsyncButton,
  AdminButton,
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
import { useSettingsMessages } from "./messages";
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
  const text = useSettingsMessages();
  const activeSection = useSettingsSection();
  const credentialForm = useRef<HTMLFormElement>(null);
  const [credentialsDirty, setCredentialsDirty] = useState(false);
  const [appearance, setAppearance] = useState<Appearance | null>(null);
  const [appearanceDirty, setAppearanceDirty] = useState(false);
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

  const unsavedChanges = dirty || credentialsDirty || appearanceDirty;

  const updateAppearance = useCallback(
    (selection: Appearance, changed: boolean) => {
      setAppearance(selection);
      setAppearanceDirty(changed);
    },
    [],
  );

  useEffect(() => {
    if (!unsavedChanges) {
      return;
    }

    function preventLeaving(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = true;
    }

    window.addEventListener("beforeunload", preventLeaving);

    return () => window.removeEventListener("beforeunload", preventLeaving);
  }, [unsavedChanges]);

  const postsPerPageInvalid = !PostsPerPageSchema.safeParse(form.postsPerPage)
    .success;

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

    if (await save(credentials, appearance ?? undefined)) {
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
      showToast(text.saved, "success");
      setAppearanceDirty(false);
    }
  };

  if (loading && !loaded) {
    return (
      <AdminPageLayout title={text.title} workspace="settings">
        <DataListLoading label="settings" message={text.loading} />
      </AdminPageLayout>
    );
  }

  if (!loaded) {
    return (
      <AdminPageLayout title={text.title} workspace="settings">
        <Alert
          message={loadError ? text.loadError : text.notLoaded}
          status="error"
        />
        <AdminButton onClick={() => void retry()}>{text.retry}</AdminButton>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title={text.title}
      workspace="settings"
      description={text.description}
      actions={
        <AdminAsyncButton
          type="submit"
          form="admin-settings-form"
          color="primary"
          loading={saving}
          disabled={loading || !!loadError}
          icon={FaSave}
        >
          <span className="min-w-0">{text.save}</span>
        </AdminAsyncButton>
      }
    >
      <div className="admin-settings-workspace admin-tab-stack">
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
              <AdminAsyncButton loading={loading} onClick={() => void retry()}>
                {text.retryLoad}
              </AdminAsyncButton>
            )}
            <Alert message={error ? text.saveError : null} status="error" />
            <SettingsPanel
              id="settings-general"
              active={activeSection}
              className="admin-settings-general"
            >
              <fieldset disabled={saving} className="min-w-0">
                <div className="admin-settings-general-layout">
                  <Section
                    title={text.siteInfo}
                    desc={text.siteInfoDescription}
                  >
                    <div className="admin-settings-field-grid">
                      <div>
                        <Field label={text.siteName} htmlFor="site-name">
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
                        <Field
                          label={text.descriptionLabel}
                          htmlFor="site-description"
                        >
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
                          label={text.siteUrl}
                          htmlFor="site-url"
                          hint={text.canonicalHint}
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
                        <Field label={text.ogImage} htmlFor="og-image-url">
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
                  <div
                    id="settings-appearance"
                    className="admin-settings-appearance-anchor"
                  >
                    <AppearanceSettings onChangeAction={updateAppearance} />
                  </div>
                </div>
              </fieldset>
            </SettingsPanel>
            <fieldset disabled={saving} className="grid min-w-0 gap-6">
              <SettingsPanel id="settings-publishing" active={activeSection}>
                <Section
                  title={text.publishing}
                  desc={text.publishingDescription}
                  className="admin-settings-compact-panel"
                >
                  <div className="admin-settings-field-grid">
                    <div>
                      <Field
                        label={text.listingMode}
                        htmlFor="post-listing-mode"
                      >
                        <Select
                          id="post-listing-mode"
                          fullWidth
                          value={form.postListingMode}
                          options={[
                            { value: "PAGINATION", label: text.pagination },
                            { value: "LOAD_MORE", label: text.loadMore },
                          ]}
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
                        label={text.postsPerBatch}
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
                          hint={text.postsPerBatchHint}
                          error={
                            postsPerPageInvalid
                              ? text.postsPerBatchError
                              : undefined
                          }
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
                  title={text.accountDefaults}
                  desc={text.accountDefaultsDescription}
                  className="admin-settings-account-defaults"
                >
                  <FormGrid12>
                    <Field
                      label={text.defaultRole}
                      htmlFor="default-user-role"
                      span={12}
                    >
                      <Select
                        id="default-user-role"
                        fullWidth
                        value={form.defaultUserRole}
                        options={ROLES.map((role) => ({
                          value: role,
                          label: text.roles[role],
                        }))}
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

                <Section title={text.oauth} desc={text.oauthDescription}>
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
                                    ? text.configured
                                    : text.credentialsRequired}
                                </span>
                                <Badge
                                  className={
                                    provider.enabled
                                      ? undefined
                                      : "admin-badge-muted"
                                  }
                                >
                                  {provider.enabled
                                    ? text.enabled
                                    : text.disabled}
                                </Badge>
                              </span>
                              <FiChevronDown aria-hidden="true" />
                            </summary>
                            <fieldset className="admin-provider-fields">
                              <Toggle
                                aria-label={`${text.enableProvider} ${provider.provider}`}
                                checked={provider.enabled}
                                onChangeAction={(enabled) =>
                                  setForm((current) =>
                                    updateProviderAtIndex(current, index, {
                                      enabled,
                                    }),
                                  )
                                }
                                inlineLabel={text.allowSignIn}
                              />
                              <Input
                                label={`${provider.provider} ${text.clientId}`}
                                fullWidth
                                maxLength={2000}
                                value={provider.clientId}
                                placeholder={
                                  provider.hasClientId
                                    ? text.configuredValue
                                    : ""
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
                                label={`${provider.provider} ${text.newSecret}`}
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
                                      ? text.configuredSecret
                                      : text.required
                                  }
                                />
                              </Field>
                            </fieldset>
                          </details>
                        );
                      })
                    ) : (
                      <p className="text-sm text-(--text-muted)">
                        {text.noProviders}
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
                  {saving ? text.saving : unsavedChanges ? text.unsaved : ""}
                </p>
              </div>
            </fieldset>
          </form>
        </div>
      </div>
    </AdminPageLayout>
  );
}
