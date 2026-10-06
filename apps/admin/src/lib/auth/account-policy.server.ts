import "server-only";

import { emailSchema, passwordSchema, MAX_PASSWORD_LENGTH } from "@nextpress/shared/auth-policy";
import { APIError, createAuthMiddleware } from "better-auth/api";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const accountPolicy = createAuthMiddleware(async (ctx) => {
  // No delivery infrastructure is configured. Do not mint recovery tokens or
  // claim delivery, including for OAuth-only accounts or unknown addresses.
  if (ctx.path === "/request-password-reset" || ctx.path === "/reset-password" ||
    ctx.path?.startsWith("/reset-password/") || ctx.path === "/send-verification-email" || ctx.path === "/verify-email") {
    throw new APIError("SERVICE_UNAVAILABLE", {
      code: "ACCOUNT_EMAIL_UNAVAILABLE",
      message: "Email verification and password recovery are unavailable. Contact an administrator.",
    });
  }

  const body: unknown = ctx.body;
  if (!isRecord(body)) return;
  const input = body;

  if (ctx.path === "/sign-up/email" && ("role" in input || "roleId" in input)) {
    throw new APIError("BAD_REQUEST", { code: "INVALID_INPUT", message: "Role assignment is not allowed" });
  }

  const normalized = { ...input };
  for (const field of ["email", "newEmail"] as const) {
    if (!(field in input)) continue;
    const result = emailSchema.safeParse(input[field]);
    if (!result.success) throw new APIError("BAD_REQUEST", { code: "INVALID_EMAIL", message: "Invalid email" });
    normalized[field] = result.data;
  }

  const newPassword = ctx.path === "/sign-up/email" ? input.password : input.newPassword;
  if (newPassword !== undefined) {
    const result = passwordSchema.safeParse(newPassword);
    if (!result.success) throw new APIError("BAD_REQUEST", {
      code: "INVALID_PASSWORD", message: result.error.issues[0]?.message ?? "Invalid password",
    });
  }

  for (const field of ["password", "currentPassword"] as const) {
    if (typeof input[field] === "string" && input[field].length > MAX_PASSWORD_LENGTH) {
      throw new APIError("BAD_REQUEST", { code: "PASSWORD_TOO_LONG", message: "Password is too long" });
    }
  }
  return { context: { body: normalized } };
});
