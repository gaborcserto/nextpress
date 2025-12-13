import { z } from "zod";

import { TagIdsSchema } from "./tag"

/** Create PAGE / POST */
export const PageSchema = z.object({
  type: z.enum(["PAGE", "POST"]),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  slug: z.string().trim().min(1),
  title: z.string().trim().min(1),
  excerpt: z.string().default(""),
  content: z.string().default(""),

  tagIds: TagIdsSchema,
});

export type PageCreateInput = Omit<z.infer<typeof PageSchema>, "tagIds">;

/** Update PAGE / POST */
export const PageUpdateSchema = z.object({
  type: z.enum(["PAGE", "POST"]).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  slug: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  excerpt: z.string().optional(),
  content: z.string().optional(),

  tagIds: TagIdsSchema.optional(),
});

export type PageUpdateInput = Omit<
  z.infer<typeof PageUpdateSchema>,
  "tagIds"
>;
