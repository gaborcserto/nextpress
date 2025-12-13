import { z } from "zod";

export const TagIdsSchema = z.array(
  z.string().trim().min(1)
).default([]);

export const TagCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
});

export type TagCreateInput = z.infer<typeof TagCreateSchema>;
