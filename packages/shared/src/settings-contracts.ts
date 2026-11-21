import { z } from "zod";

import { OAUTH_PROVIDERS } from "./oauth-providers";
import {
  PostListingModeSchema,
  PostsPerPageSchema,
} from "./post-listing-settings";
import { ROLES } from "./roles";
import { SiteDateTimeSchema } from "./site-date-time";

function hasCompleteOAuthProviders(
  providers: ReadonlyArray<{ provider: string }>,
): boolean {
  const names = new Set(providers.map(({ provider }) => provider));

  return (
    providers.length === OAUTH_PROVIDERS.length &&
    OAUTH_PROVIDERS.every((provider) => names.has(provider))
  );
}

export const SettingsPayloadSchema = z.object({
  dateTime: SiteDateTimeSchema.optional(),
  siteName: z.string(),
  siteDescription: z.string(),
  siteUrl: z.string(),
  ogImageUrl: z.string(),
  defaultUserRole: z.enum(ROLES),
  postListingMode: PostListingModeSchema,
  postsPerPage: z.number(),
  oauthProviders: z
    .array(
      z.object({
        provider: z.enum(OAUTH_PROVIDERS),
        enabled: z.boolean(),
        clientId: z.string(),
        clientSecret: z.string().optional(),
      }),
    )
    .length(OAUTH_PROVIDERS.length)
    .refine(hasCompleteOAuthProviders),
});

function validOptionalHttpUrl(value: string): boolean {
  if (!value.trim()) {
    return true;
  }

  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** Public write contract; credential availability is resolved only inside API. */
export const SettingsUpdateSchema = SettingsPayloadSchema.extend({
  siteName: z
    .string()
    .max(200)
    .refine((value) => Boolean(value.trim())),
  siteDescription: z.string().max(1000),
  siteUrl: z.string().max(2000).refine(validOptionalHttpUrl),
  ogImageUrl: z.string().max(2000).refine(validOptionalHttpUrl),
  postsPerPage: PostsPerPageSchema,
  oauthProviders: SettingsPayloadSchema.shape.oauthProviders.element
    .extend({
      clientId: z.string().max(2000),
      clientSecret: z.string().max(10000).optional().meta({
        writeOnly: true,
        description:
          "Omit or leave blank to retain the stored secret. Never returned.",
      }),
    })
    .array()
    .length(OAUTH_PROVIDERS.length)
    .refine(hasCompleteOAuthProviders),
});

export type SettingsApiPayload = z.infer<typeof SettingsPayloadSchema>;

const OAuthCredentialStatusSchema = z.object({
  provider: z.enum(OAUTH_PROVIDERS),
  hasClientId: z.boolean(),
  hasClientSecret: z.boolean(),
  operational: z.boolean(),
});

export const SettingsSavedSchema = z.object({
  ok: z.literal(true),
  oauthProviders: OAuthCredentialStatusSchema.array()
    .length(OAUTH_PROVIDERS.length)
    .refine(hasCompleteOAuthProviders),
});

// Reject incomplete authoritative responses instead of normalizing them into writable defaults.
export const SettingsResponseSchema = z.object({
  dateTime: SiteDateTimeSchema.optional(),
  siteName: z.string(),
  siteDescription: z.string(),
  siteUrl: z.string(),
  ogImageUrl: z.string(),
  defaultUserRole: z.enum(ROLES),
  postListingMode: PostListingModeSchema,
  postsPerPage: PostsPerPageSchema,
  oauthProviders: OAuthCredentialStatusSchema.extend({
    enabled: z.boolean(),
    clientId: z.string(),
  })
    .array()
    .length(OAUTH_PROVIDERS.length)
    .refine(hasCompleteOAuthProviders),
});
