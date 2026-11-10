import type { OAuthProviderName } from "./oauth-providers";
import type { PostListingMode } from "./post-listing-settings";
import type { RoleName } from "./roles";
export type SettingsApiPayload = {
  siteName: string;
  siteDescription: string;
  siteUrl: string;
  ogImageUrl: string;
  defaultUserRole: RoleName;
  postListingMode: PostListingMode;
  postsPerPage: number;
  oauthProviders: Array<
    { provider: OAuthProviderName; enabled: boolean; clientId: string } & {
      clientSecret?: string;
    }
  >;
};
