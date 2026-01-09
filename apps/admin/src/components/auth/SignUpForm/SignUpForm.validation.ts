import { z } from "zod";

export const signUpSchema = z.object({
  name: z
    .string()
    .min(2, { message: "Name is too short" })
    .max(64, { message: "Name is too long" })
    .optional()
    .or(z.literal("")),
  email: z.email({ message: "Invalid email" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
});
