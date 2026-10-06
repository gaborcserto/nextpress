import "server-only";

import { APIError, createAuthMiddleware } from "better-auth/api";

import { resetSuccessfulLogin } from "./abuse-policy.server";

// Better Auth 1.7.6 catches sign-out deletion errors. Verify its postcondition
// so a storage failure cannot be presented as successful session revocation.
export const verifyLogout = createAuthMiddleware(async (ctx) => {
  await resetSuccessfulLogin(ctx);
  if (ctx.path !== "/sign-out" || ctx.context.returned instanceof APIError) return;
  const token = await ctx.getSignedCookie(ctx.context.authCookies.sessionToken.name, ctx.context.secret);
  if (!token) return;
  try {
    if (!await ctx.context.internalAdapter.findSession(token)) return;
  } catch {
    // A failed authoritative read also cannot establish successful logout.
  }
  throw new APIError("INTERNAL_SERVER_ERROR", {
    code: "SESSION_REVOCATION_FAILED", message: "Logout could not be completed. Please try again.",
  });
});
