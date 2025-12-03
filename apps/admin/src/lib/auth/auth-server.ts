import "server-only";

import { prisma } from "@nextpress/db/src/client";
import bcrypt from "bcryptjs";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";

import { unauthorized } from "@/lib/api";

export type RoleName = "ADMIN" | "EDITOR" | "AUTHOR" | "SUBSCRIBER";

// --- better-auth config ---

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    password: {
      hash: async (password: string) => bcrypt.hash(password, 10),
      verify: async ({ hash, password }: { hash: string; password: string }) =>
        bcrypt.compare(password, hash),
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
    additionalFields: {
      roleName: {
        type: "string",
        required: false,
        defaultValue: "user",
        input: false,
        returned: true,
      },
    },
  },

  trustedOrigins: [
    process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:5174",
  ],

  basePath: "/api/auth",
  plugins: [nextCookies()],
});

export type AppAuth = typeof auth;

// --- helpers: session, roles, withAuth ---

export async function getSession() {
  const header = await headers();
  // Read session from Better Auth using the current request headers
  return auth.api.getSession({ headers: header });
}

export async function getUserRole(userId?: string | null) {
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: { select: { name: true } } },
  });

  return user?.role?.name ?? null;
}

/**
 * Check if the given role is one of the allowed roles.
 * Acts as a type guard to avoid casts later.
 */
export function hasAnyRole(
  roleName: string | null | undefined,
  allowed: readonly RoleName[]
): roleName is RoleName {
  if (!roleName) return false;

  const normalized = roleName.toUpperCase() as RoleName;
  return allowed.includes(normalized);
}

type HandlerCtx<P extends Record<string, string> = Record<string, string>> = {
  params: P;
};

type RawHandlerCtx<P extends Record<string, string> = Record<string, string>> = {
  params: P | Promise<P>;
};

type Authed = {
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
  roleName: RoleName;
};

/**
 * Wrap a route handler with auth + role check.
 *
 * Usage in route.ts:
 * export const GET = withAuth(["ADMIN"], async (req, ctx, auth) => { ... })
 */
export function withAuth<
  P extends Record<string, string> = Record<string, string>
>(
  allowed: RoleName[],
  handler: (
    req: Request,
    ctx: HandlerCtx<P>,
    auth: Authed
  ) => Promise<Response> | Response
) {
  return async (req: Request, ctx: RawHandlerCtx<P>) => {
    const params = await ctx.params;
    const handlerCtx: HandlerCtx<P> = { params };

    const session = await getSession();
    if (!session?.user?.id) {
      return unauthorized();
    }

    const roleName = await getUserRole(session.user.id);
    if (!hasAnyRole(roleName, allowed)) {
      return unauthorized();
    }

    return handler(req, handlerCtx, {
      session,
      roleName,
    });
  };
}
