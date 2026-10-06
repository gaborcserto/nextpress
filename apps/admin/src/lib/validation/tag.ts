import { z } from "zod";

export const TagIdsSchema = z.array(z.string().trim().min(1).max(64))
  .max(100, "At most 100 tags may be assigned")
  .refine((ids) => new Set(ids).size === ids.length, "Duplicate tag IDs are not allowed")
  .default([]);

export const TagCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
});

export type TagCreateInput = z.infer<typeof TagCreateSchema>;
