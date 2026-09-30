import type { OAuthProviderName } from "@/lib/auth/oauth-providers";
import type { RoleName } from "@/lib/auth/roles";

export type OAuthProviderSettings = {
  provider: OAuthProviderName;
  enabled: boolean;
  clientId: string;
  hasClientId: boolean;
  hasClientSecret: boolean;
  operational: boolean;
};

export type SettingsFormValues = {
  siteName: string;
  siteDescription: string;
  siteUrl: string;
  ogImageUrl: string;
  defaultUserRole: RoleName;
  oauthProviders: OAuthProviderSettings[];
};

export type ProviderCredentialUpdates = Partial<
  Record<OAuthProviderName, { clientSecret?: string }>
>;

export type SettingsApiResponse = SettingsFormValues;

export type SettingsApiPayload = Omit<SettingsFormValues, "oauthProviders"> & {
  oauthProviders: Array<
    Pick<OAuthProviderSettings, "provider" | "enabled" | "clientId"> & {
      clientSecret?: string;
    }
  >;
};

export function normalizeSettingsForm(
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

export function buildSettingsPayload(
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
