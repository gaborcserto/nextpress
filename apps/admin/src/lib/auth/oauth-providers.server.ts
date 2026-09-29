import "server-only";

import {
  OAUTH_PROVIDERS,
  isOAuthProviderName,
  type OAuthProviderName,
} from "./oauth-providers";
import type { BetterAuthOptions } from "better-auth";

export type OAuthProviderRow = {
  provider: string;
  enabled: boolean;
  clientId: string | null;
  clientSecret: string | null;
};

function nonEmpty(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}

function rowFor(rows: readonly OAuthProviderRow[], provider: OAuthProviderName) {
  return rows.find((row) => row.provider === provider);
}

function credentialsFor(row: OAuthProviderRow, provider: OAuthProviderName) {
  const environment = {
    apple: {
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    },
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
    },
  }[provider];

  return {
    clientId: nonEmpty(row.clientId) ?? nonEmpty(environment.clientId),
    clientSecret:
      nonEmpty(row.clientSecret) ?? nonEmpty(environment.clientSecret),
  };
}

export function getOAuthProviderStatus(row: OAuthProviderRow): {
  hasClientId: boolean;
  hasClientSecret: boolean;
  operational: boolean;
} {
  const provider = isOAuthProviderName(row.provider) ? row.provider : null;
  const credentials = provider ? credentialsFor(row, provider) : null;

  return {
    hasClientId: !!credentials?.clientId,
    hasClientSecret: !!credentials?.clientSecret,
    operational: !!(
      row.enabled &&
      credentials?.clientId &&
      credentials.clientSecret
    ),
  };
}

export function buildSocialProviders(
  rows: readonly OAuthProviderRow[],
): NonNullable<BetterAuthOptions["socialProviders"]> {
  const providers: NonNullable<BetterAuthOptions["socialProviders"]> = {};

  for (const provider of OAUTH_PROVIDERS) {
    const row = rowFor(rows, provider);
    if (!row || !getOAuthProviderStatus(row).operational) continue;

    const credentials = credentialsFor(row, provider);
    const config = {
      clientId: credentials.clientId!,
      clientSecret: credentials.clientSecret!,
    };

    if (provider === "apple") providers.apple = config;
    if (provider === "discord") providers.discord = config;
    if (provider === "facebook") providers.facebook = config;
    if (provider === "github") providers.github = config;
    if (provider === "google") providers.google = config;
    if (provider === "twitter") providers.twitter = config;
  }

  return providers;
}

export function operationalProviderNames(
  rows: readonly OAuthProviderRow[],
): OAuthProviderName[] {
  return rows
    .filter((row) => getOAuthProviderStatus(row).operational)
    .map((row) => row.provider)
    .filter(isOAuthProviderName);
}
