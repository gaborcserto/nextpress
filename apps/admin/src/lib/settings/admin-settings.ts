import {
  DEFAULT_POST_LISTING_MODE,
  PostListingModeSchema,
  PostsPerPageSchema,
  normalizePostsPerPage,
  type PostListingMode,
} from "@nextpress/shared";

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
  postListingMode: PostListingMode;
  postsPerPage: number | "";
  oauthProviders: OAuthProviderSettings[];
};

export type ProviderCredentialUpdates = Partial<
  Record<OAuthProviderName, { clientSecret?: string }>
>;

export type SettingsApiResponse = Omit<SettingsFormValues, "postsPerPage"> & { postsPerPage: number };
type SettingsApiData = Partial<Omit<SettingsApiResponse, "postListingMode" | "postsPerPage">> & {
  postListingMode?: unknown;
  postsPerPage?: unknown;
};

export type SettingsApiPayload = Omit<SettingsFormValues, "oauthProviders" | "postsPerPage"> & {
  postsPerPage: number;
  oauthProviders: Array<
    Pick<OAuthProviderSettings, "provider" | "enabled" | "clientId"> & {
      clientSecret?: string;
    }
  >;
};

export function normalizeSettingsForm(
  data: SettingsApiData | null | undefined,
  fallbackRole: RoleName,
): SettingsFormValues {
  const postListingMode = PostListingModeSchema.safeParse(data?.postListingMode);
  return {
    siteName: data?.siteName ?? "",
    siteDescription: data?.siteDescription ?? "",
    siteUrl: data?.siteUrl ?? "",
    ogImageUrl: data?.ogImageUrl ?? "",
    defaultUserRole: data?.defaultUserRole ?? fallbackRole,
    postListingMode: postListingMode.success ? postListingMode.data : DEFAULT_POST_LISTING_MODE,
    postsPerPage: normalizePostsPerPage(data?.postsPerPage),
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
    postListingMode: form.postListingMode,
    postsPerPage: PostsPerPageSchema.parse(form.postsPerPage),
    oauthProviders: form.oauthProviders.map((provider) => ({
      provider: provider.provider,
      enabled: provider.enabled,
      clientId: provider.clientId,
      ...credentials[provider.provider],
    })),
  };
}
