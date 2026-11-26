import { emailSchema, passwordSchema } from "@nextpress/shared/auth-policy";
import { z } from "zod";

export const signUpSchema = z.object({
  name: z
    .string()
    .min(2, { message: "Name is too short" })
    .max(64, { message: "Name is too long" })
    .optional()
    .or(z.literal("")),
  email: emailSchema,
  password: passwordSchema,
});

export type SignUpFormValues = z.infer<typeof signUpSchema>;
