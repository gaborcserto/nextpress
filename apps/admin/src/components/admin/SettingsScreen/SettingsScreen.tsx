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
import {
  Button,
  Field,
  FormGrid12,
  Input,
  Section,
  Select,
  StickyWrapper,
  Toggle,
} from "@/ui/primitives";

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
  const { form, setForm, loading, saving, save } =
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
      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-6 self-start">
          <header className="h-20 flex flex-col justify-center space-y-1">
            <h1 className="text-2xl font-semibold">Settings</h1>
            <p className="text-base-content/70">
              Site name, defaults, and OAuth providers.
            </p>
          </header>

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
        </aside>

        <main className="lg:col-span-8 space-y-6 min-w-0 lg:pt-26">
          <Section
            title="OAuth providers"
            desc="Only enabled providers with complete credentials are available for sign-in. Environment credentials are used when stored values are blank."
          >
            <div className="overflow-x-auto w-full bg-base-100 rounded-lg shadow border border-base-300">
              <table className="table table-zebra w-full">
                <thead className="bg-base-200">
                  <tr>
                    <th>Provider</th>
                    <th>Status</th>
                    <th>Client ID</th>
                    <th>New secret</th>
                  </tr>
                </thead>

                <tbody>
                  {form.oauthProviders.map((provider, index) => {
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
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </main>
      </div>
    </form>
  );
}
