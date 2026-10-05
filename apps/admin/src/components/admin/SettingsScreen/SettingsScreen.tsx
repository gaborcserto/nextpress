"use client";

import { useRef } from "react";
import { FaSave } from "react-icons/fa";

import { useSettingsScreen } from "./SettingsScreen.hooks";
import type {
  ProviderCredentialUpdates,
  SettingsFormValues,
} from "./SettingsScreen.types";
import type { OAuthProviderName } from "@/lib/auth/oauth-providers";
import { ROLES, type RoleName } from "@/lib/auth/roles";
import { DataListEmptyRow, DataListSurface } from "@/ui/components/DataList";
import {
  Button,
  Alert,
  Field,
  FormGrid12,
  Input,
  Section,
  Select,
  StickyWrapper,
  Toggle,
} from "@/ui/primitives";
import { AdminPageColumns, AdminPageLayout } from "@/ui/shell";

const ROLE_OPTIONS = ROLES.map((role) => ({ value: role, label: role }));

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
    if (Object.keys(update).length) updates[provider] = update;
  }

  return updates;
}

export default function SettingsScreen() {
  const credentialForm = useRef<HTMLFormElement>(null);
  const { form, setForm, loading, saving, error, save } =
    useSettingsScreen("SUBSCRIBER");

  const saveSettings = async () => {
    if (!credentialForm.current) return;
    const credentials = readCredentialUpdates(
      credentialForm.current,
      form.oauthProviders.map((provider) => provider.provider),
    );
    if (await save(credentials)) credentialForm.current.reset();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <span className="loading loading-spinner" />
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <form ref={credentialForm} className="space-y-6 w-full">
      <Alert message={error} status="error" />
      <AdminPageLayout title="Settings" description="Site name, defaults, and OAuth providers.">
        <AdminPageColumns sidebar={
          <>
          <Section title="General" desc="Basic metadata used across the site.">
            <FormGrid12>
              <Field label="Site name" span={12}>
                <Input
                  fullWidth
                  value={form.siteName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      siteName: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Description" span={12}>
                <Input
                  fullWidth
                  value={form.siteDescription}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      siteDescription: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Site URL" hint="Used for canonical URLs." span={12}>
                <Input
                  fullWidth
                  value={form.siteUrl}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      siteUrl: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Default OG image URL" span={12}>
                <Input
                  fullWidth
                  value={form.ogImageUrl}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      ogImageUrl: event.target.value,
                    }))
                  }
                />
              </Field>
            </FormGrid12>
          </Section>

          <Section title="Defaults" desc="Defaults for newly created users.">
            <FormGrid12>
              <Field label="Default user role" span={12}>
                <Select
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

          <StickyWrapper>
            <Button
              type="button"
              color="primary"
              loading={saving}
              onClick={() => void saveSettings()}
              className="min-w-40"
            >
              <FaSave />
              Save settings
            </Button>
          </StickyWrapper>
          </>
        }>

          <Section
            title="OAuth providers"
            desc="Only enabled providers with complete credentials are available for sign-in. Environment credentials are used when stored values are blank."
          >
            <DataListSurface>
              <table className="table min-w-[720px] table-zebra w-full">
                <thead className="bg-base-200">
                  <tr>
                    <th>Provider</th>
                    <th>Status</th>
                    <th>Client ID</th>
                    <th>New secret</th>
                  </tr>
                </thead>

                <tbody>
                  {form.oauthProviders.length ? form.oauthProviders.map((provider, index) => {
                    const configured =
                      provider.hasClientId &&
                      provider.hasClientSecret;

                    return (
                      <tr key={provider.provider}>
                        <td className="font-medium">{provider.provider}</td>
                        <td className="whitespace-nowrap">
                          <Toggle
                            checked={provider.enabled}
                            onChangeAction={(enabled) =>
                              setForm((current) =>
                                updateProviderAtIndex(current, index, { enabled }),
                              )
                            }
                            inlineLabel={
                              provider.enabled
                                ? configured
                                  ? "Ready"
                                  : "Credentials required"
                                : "Disabled"
                            }
                          />
                        </td>
                        <td>
                          <Input
                            fullWidth
                            value={provider.clientId}
                            placeholder={provider.hasClientId ? "Using environment value" : ""}
                            onChange={(event) =>
                              setForm((current) =>
                                updateProviderAtIndex(current, index, {
                                  clientId: event.target.value,
                                  hasClientId: !!event.target.value,
                                }),
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="input w-full"
                            type="password"
                            name={`clientSecret:${provider.provider}`}
                            autoComplete="new-password"
                            placeholder={
                              provider.hasClientSecret
                                ? "Stored value preserved"
                                : "Required"
                            }
                          />
                        </td>
                      </tr>
                    );
                  }) : (
                    <DataListEmptyRow colSpan={4}>No OAuth providers configured.</DataListEmptyRow>
                  )}
                </tbody>
              </table>
            </DataListSurface>
          </Section>
        </AdminPageColumns>
      </AdminPageLayout>
    </form>
  );
}
