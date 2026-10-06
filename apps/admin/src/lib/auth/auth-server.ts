import "server-only";

import { prisma } from "@nextpress/db/src/client";
import bcrypt from "bcryptjs";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { cache } from "react";

import { OAUTH_PROVIDERS } from "./oauth-providers";
import {
  buildSocialProviders,
  operationalProviderNames,
  type OAuthProviderRow,
} from "./oauth-providers.server";
import { isRole, type RoleName } from "./roles";
import { unauthorized } from "@/lib/api";

const BASE_URL =
  process.env.BETTER_AUTH_URL ||
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
  process.env.NEXT_PUBLIC_ADMIN_URL ||
  "http://localhost:49101";

const TRUSTED_ORIGINS = [
  process.env.NEXT_PUBLIC_ADMIN_URL,
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
  process.env.BETTER_AUTH_URL,
  "http://localhost:3000",
  "http://localhost:5174",
  "http://localhost:49101",
].filter(Boolean) as string[];

function createAuth(providerRows: readonly OAuthProviderRow[]) {
  return betterAuth({
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    baseURL: BASE_URL,

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      password: {
        hash: async (password: string) => bcrypt.hash(password, 10),
        verify: async ({ hash, password }: { hash: string; password: string }) =>
          bcrypt.compare(password, hash),
      },
    },

    socialProviders: buildSocialProviders(providerRows),

    session: {
      modelName: "Session",
      fields: {
        id: "id",
        token: "sessionToken",
        expiresAt: "expires",
        createdAt: "createdAt",
        updatedAt: "updatedAt",
        ipAddress: "ipAddress",
        userAgent: "userAgent",
        userId: "userId",
      },
    },

    account: {
      modelName: "Account",
      fields: {
        providerId: "provider",
        accountId: "providerAccountId",
        refreshToken: "refresh_token",
        accessToken: "access_token",
        accessTokenExpiresAt: "expires_at",
        tokenType: "token_type",
        scope: "scope",
        idToken: "id_token",
        sessionState: "session_state",
        password: "password",
      },
    },

    user: {
      modelName: "User",
      additionalFields: {
        roleId: { type: "string", required: false, input: false },
      },
    },

    databaseHooks: {
      user: {
        create: {
          before: async () => {
            const role = await prisma.role.findUniqueOrThrow({
              where: { name: "SUBSCRIBER" },
              select: { id: true },
            });
            return { data: { roleId: role.id } };
          },
        },
      },
    },

    trustedOrigins: TRUSTED_ORIGINS,
    basePath: "/api/auth",
    plugins: [nextCookies()],
  });
}

export type AppAuth = ReturnType<typeof createAuth>;

async function readOAuthProviderRows(): Promise<OAuthProviderRow[]> {
  const rows = await prisma.oAuthProvider.findMany({
    where: { provider: { in: [...OAUTH_PROVIDERS] } },
    select: {
      provider: true,
      enabled: true,
      clientId: true,
      clientSecret: true,
    },
  });

  if (rows.length) return rows;
  return OAUTH_PROVIDERS.map((provider) => ({
    provider,
    enabled: true,
    clientId: null,
    clientSecret: null,
  }));
}

export async function getAuth(): Promise<AppAuth> {
  return createAuth(await readOAuthProviderRows());
}

export async function getOperationalOAuthProviders() {
  return operationalProviderNames(await readOAuthProviderRows());
}

async function readRoleName(userId: string): Promise<RoleName | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: { select: { name: true } }, roleId: true },
  });

  const name = user?.role?.name ?? null;
  return isRole(name) ? name : null;
}

/**
 * Ensures the user has a role set in the DB.
 * Roleless users receive SUBSCRIBER, independently of administrative defaults.
 *
 * Note: assumes Role rows are seeded (ADMIN/EDITOR/AUTHOR/SUBSCRIBER).
 */
async function ensureDefaultRole(userId: string): Promise<RoleName | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { roleId: true },
  });

  if (!user) return null;

  if (user.roleId) return readRoleName(userId);

  const role = await prisma.role.findUniqueOrThrow({
    where: { name: "SUBSCRIBER" },
    select: { id: true },
  });
  // Do not overwrite a concurrent explicit administrative role assignment.
  await prisma.user.updateMany({
    where: { id: userId, roleId: null },
    data: { roleId: role.id },
  });
  return readRoleName(userId);
}

/**
 * Reads the user's role name from DB.
 * Use ensureDefaultRole() if you want to guarantee a default role exists.
 */
export async function getUserRole(userId?: string | null): Promise<RoleName | null> {
  if (!userId) return null;
  return readRoleName(userId);
}

export async function getSession() {
  const header = await headers();
  const auth = await getAuth();
  return auth.api.getSession({ headers: header });
}

type BaseSession = Awaited<ReturnType<typeof getSession>>;
type BaseUser = NonNullable<BaseSession>["user"];

export type SessionWithRole =
  | (NonNullable<BaseSession> & {
  user: NonNullable<BaseUser> & { role: RoleName | null };
})
  | null;

/**
 * Cached per request.
 * Returns the session plus user.role (from DB).
 * Better Auth's session payload does not include DB relations by default.
 */
export const getSessionWithRole = cache(async (): Promise<SessionWithRole> => {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) return null;

  const role = await ensureDefaultRole(userId);

  return {
    ...session,
    user: {
      ...session.user!,
      role,
    },
  };
});

export function hasAnyRole(
  role: RoleName | null | undefined,
  allowed: readonly RoleName[]
): role is RoleName {
  return !!role && allowed.includes(role);
}

type HandlerCtx<P extends Record<string, string> = Record<string, string>> = {
  params: P;
};

type RawHandlerCtx<P extends Record<string, string> = Record<string, string>> = {
  params: P | Promise<P>;
};

type Authed = {
  session: NonNullable<Awaited<ReturnType<typeof getSessionWithRole>>>;
  roleName: RoleName;
};

export function withAuth<P extends Record<string, string> = Record<string, string>>(
  allowed: RoleName[],
  handler: (req: Request, ctx: HandlerCtx<P>, auth: Authed) => Promise<Response> | Response
) {
  return async (req: Request, ctx: RawHandlerCtx<P>) => {
    const params = await ctx.params;

    const session = await getSessionWithRole();
    if (!session?.user?.id) return unauthorized();

    const role = session.user.role;
    if (!hasAnyRole(role, allowed)) return unauthorized();

    return handler(req, { params }, { session, roleName: role });
  };
}
