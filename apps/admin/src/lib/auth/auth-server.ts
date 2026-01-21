import "server-only";

import { prisma } from "@nextpress/db/src/client";
import bcrypt from "bcryptjs";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { cache } from "react";

import { isRole, type RoleName } from "./roles";
import { unauthorized } from "@/lib/api";

/* -------------------------------------------------------------------------- */
/* Roles                                                                      */
/* -------------------------------------------------------------------------- */

const DEFAULT_ROLE: RoleName = "SUBSCRIBER";

/* -------------------------------------------------------------------------- */
/* Config                                                                      */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Auth                                                                        */
/* -------------------------------------------------------------------------- */

export const auth = betterAuth({
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

  socialProviders: {
    apple: {
      clientId: process.env.APPLE_CLIENT_ID!,
      teamId: process.env.APPLE_TEAM_ID!,
      keyId: process.env.APPLE_KEY_ID!,
      privateKey: process.env.APPLE_PRIVATE_KEY!,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    },
  },

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
  },

  trustedOrigins: TRUSTED_ORIGINS,
  basePath: "/api/auth",
  plugins: [nextCookies()],
});

export type AppAuth = typeof auth;

/* -------------------------------------------------------------------------- */
/* DB helpers                                                                  */
/* -------------------------------------------------------------------------- */

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
 * If roleId is null, assigns DEFAULT_ROLE and returns it.
 *
 * Note: assumes Role rows are seeded (ADMIN/EDITOR/AUTHOR/SUBSCRIBER).
 */
async function ensureDefaultRole(userId: string): Promise<RoleName | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { roleId: true },
  });

  if (!user) return null;

  // Already has a roleId -> just read role name safely
  if (user.roleId) return await readRoleName(userId);

  // Assign default role
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: { connect: { name: DEFAULT_ROLE } } },
    select: { role: { select: { name: true } } },
  });

  const name = updated.role?.name ?? null;
  return isRole(name) ? name : null;
}

/**
 * Reads the user's role name from DB.
 * Use ensureDefaultRole() if you want to guarantee a default role exists.
 */
export async function getUserRole(userId?: string | null): Promise<RoleName | null> {
  if (!userId) return null;
  return await readRoleName(userId);
}

/* -------------------------------------------------------------------------- */
/* Session helpers                                                             */
/* -------------------------------------------------------------------------- */

export async function getSession() {
  const header = await headers();
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

/* -------------------------------------------------------------------------- */
/* Role utils                                                                  */
/* -------------------------------------------------------------------------- */

export function hasAnyRole(
  role: RoleName | null | undefined,
  allowed: readonly RoleName[]
): role is RoleName {
  return !!role && allowed.includes(role);
}

/* -------------------------------------------------------------------------- */
/* withAuth                                                                    */
/* -------------------------------------------------------------------------- */

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
