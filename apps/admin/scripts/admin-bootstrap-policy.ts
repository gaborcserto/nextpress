import { emailSchema, passwordSchema } from "@nextpress/shared/auth-policy";

export function getAdminBootstrapCredentials(environment: NodeJS.ProcessEnv, preserveExistingPassword = false) {
  if (environment.NODE_ENV === "production" && environment.ALLOW_PRODUCTION_ADMIN_SEED !== "true") {
    throw new Error("Production admin provisioning requires ALLOW_PRODUCTION_ADMIN_SEED=true");
  }

  return {
    email: emailSchema.parse(environment.ADMIN_EMAIL),
    // Existing credentials are repaired without creating or changing a password.
    password: preserveExistingPassword ? null : passwordSchema.parse(environment.ADMIN_PASSWORD),
  };
}
