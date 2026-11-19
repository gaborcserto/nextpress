export const runtime = "nodejs";

import { prisma } from "@nextpress/db/src/client";
import { PostListingModeSchema, PostsPerPageSchema } from "@nextpress/shared";
import {
  SettingsPayloadSchema,
  SettingsUpdateSchema,
} from "@nextpress/shared/settings-contracts";

import { bad, ok, internalError } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";
import { OAUTH_PROVIDERS } from "@/lib/auth/oauth-providers";
import {
  getOAuthProviderStatus,
  type OAuthProviderRow,
} from "@/lib/auth/oauth-providers.server";
import { isRole } from "@/lib/auth/roles";
import {
  FALLBACK_USER_ROLE,
  SITE_SETTINGS_ID,
} from "@/lib/settings/site-settings";

import type { SettingsApiPayload } from "@nextpress/shared/settings-contracts";

function isSettingsPayload(value: unknown): value is SettingsApiPayload {
  return SettingsPayloadSchema.safeParse(value).success;
}

function validOptionalUrl(value: string) {
  if (!value.trim()) {
    return true;
  }

  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function ensureSettings() {
  const settings = await prisma.siteSettings.upsert({
    where: { id: SITE_SETTINGS_ID },
    create: { id: SITE_SETTINGS_ID },
    update: {},
    select: {
      id: true,
      siteName: true,
      siteDescription: true,
      siteUrl: true,
      ogImageUrl: true,
      defaultUserRole: true,
      postListingMode: true,
      postsPerPage: true,
    },
  });

  await Promise.all(
    OAUTH_PROVIDERS.map((provider) =>
      prisma.oAuthProvider.upsert({
        where: { provider },
        create: { provider, settingsId: settings.id },
        update: {},
        select: { id: true },
      }),
    ),
  );

  return settings;
}

export const GET = withAuth(["ADMIN"], async () => {
  try {
    const settings = await ensureSettings();

    const providers = await prisma.oAuthProvider.findMany({
      where: {
        settingsId: settings.id,
        provider: { in: [...OAUTH_PROVIDERS] },
      },
      select: {
        provider: true,
        enabled: true,
        clientId: true,
        clientSecret: true,
      },
    });
    const byName = new Map(
      providers.map((provider) => [provider.provider, provider]),
    );

    return ok({
      siteName: settings.siteName,
      siteDescription: settings.siteDescription ?? "",
      siteUrl: settings.siteUrl ?? "",
      ogImageUrl: settings.ogImageUrl ?? "",
      defaultUserRole: isRole(settings.defaultUserRole)
        ? settings.defaultUserRole
        : FALLBACK_USER_ROLE,
      postListingMode: PostListingModeSchema.safeParse(settings.postListingMode)
        .success
        ? settings.postListingMode
        : "PAGINATION",
      postsPerPage: PostsPerPageSchema.safeParse(settings.postsPerPage).success
        ? settings.postsPerPage
        : 10,
      oauthProviders: OAUTH_PROVIDERS.map((provider) => {
        const row = byName.get(provider)!;

        return {
          provider,
          enabled: row.enabled,
          clientId: row.clientId ?? "",
          ...getOAuthProviderStatus(row),
        };
      }),
    });
  } catch (error) {
    return internalError(error);
  }
});

export const PUT = withAuth(
  ["ADMIN"],
  async (req) => {
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return bad("Invalid JSON");
    }

    if (!isSettingsPayload(body)) {
      return bad("Invalid settings payload");
    }

    if (!body.siteName.trim() || body.siteName.length > 200) {
      return bad("Site name is required and must not exceed 200 characters");
    }

    if (body.siteDescription.length > 1000) {
      return bad("Site description must not exceed 1000 characters");
    }

    if (!PostsPerPageSchema.safeParse(body.postsPerPage).success) {
      return bad("Posts per page must be an integer between 1 and 50");
    }

    if (body.siteUrl.length > 2000 || body.ogImageUrl.length > 2000) {
      return bad("Site URL and OG image URL must not exceed 2000 characters");
    }

    if (!validOptionalUrl(body.siteUrl) || !validOptionalUrl(body.ogImageUrl)) {
      return bad("Site URL and OG image URL must be valid HTTP(S) URLs");
    }

    let existing: OAuthProviderRow[];

    try {
      existing = await prisma.oAuthProvider.findMany({
        where: { provider: { in: [...OAUTH_PROVIDERS] } },
        select: {
          provider: true,
          enabled: true,
          clientId: true,
          clientSecret: true,
        },
      });
    } catch (error) {
      return internalError(error);
    }

    const existingByName = new Map(existing.map((row) => [row.provider, row]));

    for (const input of body.oauthProviders) {
      if (
        input.clientId.length > 2000 ||
        (input.clientSecret?.length ?? 0) > 10000
      ) {
        return bad(`Credentials are too long for provider: ${input.provider}`);
      }

      const current = existingByName.get(input.provider);
      const clientSecret = input.clientSecret?.trim();
      const candidate: OAuthProviderRow = {
        provider: input.provider,
        enabled: input.enabled,
        clientId: input.clientId,
        clientSecret: clientSecret || current?.clientSecret || null,
      };

      if (input.enabled && !getOAuthProviderStatus(candidate).operational) {
        return bad(
          `Provider ${input.provider} is missing required credentials`,
        );
      }
    }

    if (!SettingsUpdateSchema.safeParse(body).success) {
      return bad("Invalid settings payload");
    }

    try {
      const oauthProviders = await prisma.$transaction(async (tx) => {
        const settings = await tx.siteSettings.upsert({
          where: { id: SITE_SETTINGS_ID },
          create: {
            id: SITE_SETTINGS_ID,
            siteName: body.siteName.trim(),
            siteDescription: body.siteDescription.trim() || null,
            siteUrl: body.siteUrl.trim() || null,
            ogImageUrl: body.ogImageUrl.trim() || null,
            defaultUserRole: body.defaultUserRole,
            postListingMode: body.postListingMode,
            postsPerPage: body.postsPerPage,
          },
          update: {
            siteName: body.siteName.trim(),
            siteDescription: body.siteDescription.trim() || null,
            siteUrl: body.siteUrl.trim() || null,
            ogImageUrl: body.ogImageUrl.trim() || null,
            defaultUserRole: body.defaultUserRole,
            postListingMode: body.postListingMode,
            postsPerPage: body.postsPerPage,
          },
          select: { id: true },
        });

        const statuses = [];

        for (const input of body.oauthProviders) {
          const row = await tx.oAuthProvider.upsert({
            where: { provider: input.provider },
            create: {
              provider: input.provider,
              enabled: input.enabled,
              clientId: input.clientId.trim() || null,
              clientSecret: input.clientSecret?.trim() || null,
              settingsId: settings.id,
            },
            update: {
              enabled: input.enabled,
              clientId: input.clientId.trim() || null,
              ...(input.clientSecret?.trim()
                ? { clientSecret: input.clientSecret.trim() }
                : {}),
              settingsId: settings.id,
            },
            select: {
              provider: true,
              enabled: true,
              clientId: true,
              clientSecret: true,
            },
          });

          statuses.push({
            provider: input.provider,
            ...getOAuthProviderStatus(row),
          });
        }

        return statuses;
      });

      return ok({ ok: true, oauthProviders });
    } catch (error) {
      return internalError(error);
    }
  },
  "settings",
);
