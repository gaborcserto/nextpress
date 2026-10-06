import { z } from "zod";

export const MIN_PASSWORD_LENGTH = 15;
export const MAX_PASSWORD_LENGTH = 128;

export const emailSchema = z.string().trim().toLowerCase().min(1, "Email is required.")
  .max(320, "Invalid email").pipe(z.email("Invalid email"));

// Count Unicode code points for the minimum; bound UTF-16 units before hashing.
// Passwords are never trimmed or truncated.
export const passwordSchema = z.string()
  .refine((password) => !/[\uD800-\uDFFF]/u.test(password), "Password must contain valid Unicode")
  .refine((password) => password.length <= MAX_PASSWORD_LENGTH,
    `Password must not exceed ${MAX_PASSWORD_LENGTH} characters`)
  .refine((password) => Array.from(password).length >= MIN_PASSWORD_LENGTH,
    `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
