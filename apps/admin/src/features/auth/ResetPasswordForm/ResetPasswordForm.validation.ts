import { passwordSchema } from "@nextpress/shared/auth-policy";
import { z } from "zod";

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Missing token"),
    password: passwordSchema,
    confirm: passwordSchema,
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });
