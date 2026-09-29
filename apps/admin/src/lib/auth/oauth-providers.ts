export const OAUTH_PROVIDERS = [
  "apple",
  "discord",
  "facebook",
  "github",
  "google",
  "twitter",
] as const;

export type OAuthProviderName = (typeof OAUTH_PROVIDERS)[number];

export function isOAuthProviderName(value: unknown): value is OAuthProviderName {
  return (
    typeof value === "string" &&
    (OAUTH_PROVIDERS as readonly string[]).includes(value)
  );
}
