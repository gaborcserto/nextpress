import { emailSchema } from "@nextpress/shared/auth-policy";
import { z } from "zod";

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
