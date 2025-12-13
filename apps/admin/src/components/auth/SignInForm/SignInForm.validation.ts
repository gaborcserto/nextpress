import { z } from "zod";

/**
 * Zod validation schema for sign-in form.
 */
export const signInSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required.")
    .email("Please enter a valid email."),
  password: z
    .string()
    .min(1, "Password is required.")
    .min(6, "Password must be at least 6 characters."),
});

export type SignInFormValues = z.infer<typeof signInSchema>;
