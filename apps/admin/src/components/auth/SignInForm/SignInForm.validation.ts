import { emailSchema, MAX_PASSWORD_LENGTH } from "@nextpress/shared/auth-policy";
import { z } from "zod";

/**
 * Zod validation schema for sign-in form.
 */
export const signInSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, "Password is required.")
    .max(MAX_PASSWORD_LENGTH, "Password is too long"),
});

export type SignInFormValues = z.infer<typeof signInSchema>;
