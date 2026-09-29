import type { OAuthProviderName } from "@/lib/auth/oauth-providers";
import type { RoleName } from "@/lib/auth/roles";

export type OAuthProviderRow = {
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
  oauthProviders: OAuthProviderRow[];
};

export type ProviderCredentialUpdates = Partial<
  Record<OAuthProviderName, { clientSecret?: string }>
>;

export type SettingsApiResponse = SettingsFormValues;

export type SettingsApiPayload = Omit<SettingsFormValues, "oauthProviders"> & {
  oauthProviders: Array<
    Pick<OAuthProviderRow, "provider" | "enabled" | "clientId"> & {
      clientSecret?: string;
    }
  >;
};

export type SettingsScreenState = {
  form: SettingsFormValues;
  setForm: React.Dispatch<React.SetStateAction<SettingsFormValues>>;
  loading: boolean;
  saving: boolean;
  save: (credentials: ProviderCredentialUpdates) => Promise<boolean>;
};
