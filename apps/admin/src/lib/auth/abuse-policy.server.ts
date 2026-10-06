import "server-only";

import { emailSchema } from "@nextpress/shared/auth-policy";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";

import { accountAttempts, actionLimits, authBudgets, logAbuseThrottle } from "@/lib/security/rate-limit.server";

function enforce(retry: number | null) {
  if (retry === null) return;
  logAbuseThrottle();
  throw new APIError("TOO_MANY_REQUESTS", {
    code: "TOO_MANY_REQUESTS", message: "Too many requests. Please try again later.",
  }, { "Retry-After": String(retry), "Cache-Control": "no-store" });
}

function accountKey(body: unknown): string {
  const email = typeof body === "object" && body !== null && "email" in body ? body.email : undefined;
  const parsed = emailSchema.safeParse(email);
  return parsed.success ? `credential:${parsed.data}` : "credential:invalid";
}

/** Runs before validation/hashing for HTTP and direct auth.api calls. */
export const authAbusePolicy = createAuthMiddleware(async (ctx) => {
  if (ctx.path === "/sign-in/email") {
    enforce(authBudgets.consume("credential-work", 60, 60_000));
    enforce(accountAttempts.consume(accountKey(ctx.body), 5, 60_000));
  } else if (ctx.path === "/sign-up/email") {
    // Duplicate and malformed registrations spend the same budget as new ones.
    enforce(authBudgets.consume("registration-work", 10, 600_000));
    enforce(actionLimits.consume(`registration:${accountKey(ctx.body)}`, 3, 600_000));
  } else if (ctx.path === "/sign-in/social" || ctx.path === "/link-social" || ctx.path?.startsWith("/callback/")) {
    enforce(authBudgets.consume("oauth-work", 60, 60_000));
  } else if (["/change-password", "/verify-password"].includes(ctx.path ?? "")) {
    enforce(authBudgets.consume("credential-work", 60, 60_000));
    const session = await getSessionFromCtx(ctx, { disableCookieCache: true });
    if (session) {
      // One account bucket across sign-in and current-password verification.
      enforce(accountAttempts.consume(`credential:${session.user.email.trim().toLowerCase()}`, 5, 60_000));
    }
  } else if (["/update-user", "/change-email", "/unlink-account", "/get-access-token", "/refresh-token"].includes(ctx.path ?? "")) {
    const session = await getSessionFromCtx(ctx, { disableCookieCache: true });
    if (session) enforce(actionLimits.consume(`account-mutation:${session.user.id}`, 30, 60_000));
  } else if (ctx.path === "/list-sessions" || ctx.path === "/list-accounts") {
    // Better Auth returns the complete account-owned set rather than pagination.
    const session = await getSessionFromCtx(ctx, { disableCookieCache: true });
    if (session) enforce(actionLimits.consume(`account-list:${session.user.id}`, 30, 60_000));
  }
});

export const resetSuccessfulLogin = createAuthMiddleware(async (ctx) => {
  // newSession proves a completed sign-in; errors and partial successes cannot reset it.
  if (ctx.path === "/sign-in/email" && ctx.context.newSession && !(ctx.context.returned instanceof APIError)) {
    accountAttempts.reset(accountKey(ctx.body));
  }
});

export function limitAccountCreation() {
  // Covers OAuth-created accounts as well as credential registration.
  enforce(authBudgets.consume("account-creation", 30, 3_600_000));
}
