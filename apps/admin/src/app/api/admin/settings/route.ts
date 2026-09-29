export const runtime = "nodejs";

import { prisma } from "@nextpress/db/src/client";

import { bad, ok, oops } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";
import {
  OAUTH_PROVIDERS,
  isOAuthProviderName,
  type OAuthProviderName,
} from "@/lib/auth/oauth-providers";
import {
  getOAuthProviderStatus,
  type OAuthProviderRow,
} from "@/lib/auth/oauth-providers.server";
import { isRole, type RoleName } from "@/lib/auth/roles";
import {
  FALLBACK_USER_ROLE,
  SITE_SETTINGS_ID,
} from "@/lib/settings/site-settings";

type ProviderInput = {
  provider: OAuthProviderName;
  enabled: boolean;
  clientId: string;
  clientSecret?: string;
};

type SettingsPayload = {
  siteName: string;
  siteDescription: string;
  siteUrl: string;
  ogImageUrl: string;
  defaultUserRole: RoleName;
  oauthProviders: ProviderInput[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isProviderInput(value: unknown): value is ProviderInput {
  return (
    isRecord(value) &&
    isOAuthProviderName(value.provider) &&
    typeof value.enabled === "boolean" &&
    typeof value.clientId === "string" &&
    isOptionalString(value.clientSecret)
  );
}

function isSettingsPayload(value: unknown): value is SettingsPayload {
  if (
    !isRecord(value) ||
    typeof value.siteName !== "string" ||
    typeof value.siteDescription !== "string" ||
    typeof value.siteUrl !== "string" ||
    typeof value.ogImageUrl !== "string" ||
    !isRole(value.defaultUserRole) ||
    !Array.isArray(value.oauthProviders) ||
    !value.oauthProviders.every(isProviderInput)
  ) {
    return false;
  }

  const providers = value.oauthProviders.map((row) => row.provider);
  return (
    providers.length === OAUTH_PROVIDERS.length &&
    new Set(providers).size === OAUTH_PROVIDERS.length &&
    OAUTH_PROVIDERS.every((provider) => providers.includes(provider))
  );
}

function validOptionalUrl(value: string) {
  if (!value.trim()) return true;
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
    const byName = new Map(providers.map((provider) => [provider.provider, provider]));

    return ok({
      siteName: settings.siteName,
      siteDescription: settings.siteDescription ?? "",
      siteUrl: settings.siteUrl ?? "",
      ogImageUrl: settings.ogImageUrl ?? "",
      defaultUserRole: isRole(settings.defaultUserRole)
        ? settings.defaultUserRole
        : FALLBACK_USER_ROLE,
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
  } catch {
    console.error("GET /api/admin/settings failed");
    return oops();
  }
});

export const PUT = withAuth(["ADMIN"], async (req) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON");
  }

  if (!isSettingsPayload(body)) return bad("Invalid settings payload");
  if (!body.siteName.trim() || body.siteName.length > 200) {
    return bad("Site name is required and must not exceed 200 characters");
  }
  if (body.siteDescription.length > 1000) {
    return bad("Site description must not exceed 1000 characters");
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
  } catch {
    console.error("PUT /api/admin/settings failed to read provider settings");
    return oops();
  }

  const existingByName = new Map(existing.map((row) => [row.provider, row]));
  for (const input of body.oauthProviders) {
    if (input.clientId.length > 2000 || (input.clientSecret?.length ?? 0) > 10000) {
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
      return bad(`Provider ${input.provider} is missing required credentials`);
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const settings = await tx.siteSettings.upsert({
        where: { id: SITE_SETTINGS_ID },
        create: {
          id: SITE_SETTINGS_ID,
          siteName: body.siteName.trim(),
          siteDescription: body.siteDescription.trim() || null,
          siteUrl: body.siteUrl.trim() || null,
          ogImageUrl: body.ogImageUrl.trim() || null,
          defaultUserRole: body.defaultUserRole,
        },
        update: {
          siteName: body.siteName.trim(),
          siteDescription: body.siteDescription.trim() || null,
          siteUrl: body.siteUrl.trim() || null,
          ogImageUrl: body.ogImageUrl.trim() || null,
          defaultUserRole: body.defaultUserRole,
        },
        select: { id: true },
      });

      for (const input of body.oauthProviders) {
        await tx.oAuthProvider.upsert({
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
        });
      }
    });

    return ok({ ok: true });
  } catch {
    console.error("PUT /api/admin/settings failed");
    return oops();
  }
});
