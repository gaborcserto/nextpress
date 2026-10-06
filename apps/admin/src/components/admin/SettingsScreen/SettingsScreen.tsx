"use client";

import { PostListingModeSchema, PostsPerPageSchema } from "@nextpress/shared";
import { useRef, type FormEvent } from "react";
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
import { showToast } from "@/ui/utils";

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
    if (Object.keys(update).length) updates[provider] = update;
  }

  return updates;
}

export default function SettingsScreen() {
  const credentialForm = useRef<HTMLFormElement>(null);
  const { form, setForm, loading, saving, error, save } =
    useSettingsScreen("SUBSCRIBER");
  const postsPerPageError = PostsPerPageSchema.safeParse(form.postsPerPage).success
    ? undefined
    : "Enter a whole number from 1 to 50.";

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!credentialForm.current || saving) return;
    const credentials = readCredentialUpdates(
      credentialForm.current,
      form.oauthProviders.map((provider) => provider.provider),
    );
    if (await save(credentials)) {
      credentialForm.current.reset();
      showToast("Settings saved.", "success");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2" role="status">
        <span className="loading loading-spinner" />
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <form
      ref={credentialForm}
      onSubmit={(event) => void saveSettings(event)}
      className="space-y-6"
    >
      <Alert message={error} status="error" />
      <AdminPageLayout title="Settings" description="Site name, defaults, and OAuth providers.">
        <fieldset disabled={saving} className="contents">
          <AdminPageColumns
            sidebar={
              <>
                <Section title="General" desc="Basic metadata used across the site.">
                  <FormGrid12>
                    <Field label="Site name" htmlFor="site-name" span={12}>
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

                    <Field label="Description" htmlFor="site-description" span={12}>
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

                    <Field label="Site URL" htmlFor="site-url" hint="Used for canonical URLs." span={12}>
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

                    <Field label="Default OG image URL" htmlFor="og-image-url" span={12}>
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
                  </FormGrid12>
                </Section>

                <Section title="Defaults" desc="Defaults for users created by an administrator. Public signup always receives SUBSCRIBER.">
                  <FormGrid12>
                    <Field label="Default user role" htmlFor="default-user-role" span={12}>
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

                <Section title="Post listing" desc="Choose how public post lists are navigated.">
                  <FormGrid12>
                    <Field label="Listing mode" htmlFor="post-listing-mode" span={12}>
                      <Select
                        id="post-listing-mode"
                        fullWidth
                        value={form.postListingMode}
                        options={POST_LISTING_MODE_OPTIONS}
                        onChangeAction={(value) => {
                          const parsed = PostListingModeSchema.safeParse(value);
                          if (parsed.success) {
                            setForm((current) => ({ ...current, postListingMode: parsed.data }));
                          }
                        }}
                      />
                    </Field>
                    <Field label="Posts per page / batch" htmlFor="posts-per-page" span={12}>
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
                        onChange={(event) => setForm((current) => ({
                          ...current,
                          postsPerPage: event.target.value === "" ? "" : event.target.valueAsNumber,
                        }))}
                      />
                    </Field>
                  </FormGrid12>
                </Section>

                <StickyWrapper>
                  <Button
                    type="submit"
                    color="primary"
                    loading={saving}
                    className="min-w-40"
                  >
                    <FaSave />
                    Save settings
                  </Button>
                </StickyWrapper>
              </>
            }
          >

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
                    let statusLabel = "Disabled";
                    if (provider.enabled) {
                      statusLabel = configured ? "Ready" : "Credentials required";
                    }

                    return (
                      <tr key={provider.provider}>
                        <td className="font-medium">{provider.provider}</td>
                        <td className="whitespace-nowrap">
                          <Toggle
                            aria-label={`Enable ${provider.provider}`}
                            checked={provider.enabled}
                            onChangeAction={(enabled) =>
                              setForm((current) =>
                                updateProviderAtIndex(current, index, { enabled }),
                              )
                            }
                            inlineLabel={statusLabel}
                          />
                        </td>
                        <td>
                          <Input
                            aria-label={`${provider.provider} client ID`}
                            fullWidth
                            maxLength={2000}
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
                            aria-label={`${provider.provider} new secret`}
                            maxLength={10000}
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
        </fieldset>
      </AdminPageLayout>
    </form>
  );
}
