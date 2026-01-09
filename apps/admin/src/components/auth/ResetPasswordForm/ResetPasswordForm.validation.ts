import { z } from "zod";

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Missing token"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string().min(8, "Password must be at least 8 characters"),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });
