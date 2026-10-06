import { emailSchema, passwordSchema } from "@nextpress/shared/auth-policy";

export function getAdminSeedCredentials(environment: NodeJS.ProcessEnv) {
  if (environment.NODE_ENV === "production" && environment.ALLOW_PRODUCTION_ADMIN_SEED !== "true") {
    throw new Error("Production admin seeding requires ALLOW_PRODUCTION_ADMIN_SEED=true");
  }

  return {
    email: emailSchema.parse(environment.ADMIN_EMAIL),
    password: passwordSchema.parse(environment.ADMIN_PASSWORD),
  };
}
