import { z } from "zod";

import { OAUTH_PROVIDERS } from "./oauth-providers";
import {
  PostListingModeSchema,
  PostsPerPageSchema,
} from "./post-listing-settings";
import { ROLES } from "./roles";
export const SettingsPayloadSchema = z.object({
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
    .refine(
      (providers) =>
        providers.length === OAUTH_PROVIDERS.length &&
        new Set(providers.map((row) => row.provider)).size ===
          OAUTH_PROVIDERS.length,
    ),
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
    .refine(
      (providers) =>
        new Set(providers.map((row) => row.provider)).size ===
        OAUTH_PROVIDERS.length,
    ),
});

export type SettingsApiPayload = z.infer<typeof SettingsPayloadSchema>;

// Reject incomplete authoritative responses instead of normalizing them into writable defaults.
export const SettingsResponseSchema = z.object({
  siteName: z.string(),
  siteDescription: z.string(),
  siteUrl: z.string(),
  ogImageUrl: z.string(),
  defaultUserRole: z.enum(ROLES),
  postListingMode: PostListingModeSchema,
  postsPerPage: PostsPerPageSchema,
  oauthProviders: z.array(
    z.object({
      provider: z.enum(OAUTH_PROVIDERS),
      enabled: z.boolean(),
      clientId: z.string(),
      hasClientId: z.boolean(),
      hasClientSecret: z.boolean(),
      operational: z.boolean(),
    }),
  ),
});
