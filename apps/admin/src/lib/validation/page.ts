import * as yup from "yup";

const TagIdsSchema = yup
  .array()
  .of(yup.string().trim().required())
  .default([]);

/** Create PAGE / POST */
export const PageSchema = yup.object({
  type: yup.mixed<"PAGE" | "POST">().oneOf(["PAGE", "POST"]).required(),
  status: yup
    .mixed<"DRAFT" | "PUBLISHED">()
    .oneOf(["DRAFT", "PUBLISHED"])
    .required(),
  slug: yup.string().trim().min(1).required(),
  title: yup.string().trim().min(1).required(),
  excerpt: yup.string().default(""),
  content: yup.string().default(""),

  // Tags linked to this page/post
  tagIds: TagIdsSchema,
});

export type PageCreateInput = Omit<
  yup.InferType<typeof PageSchema>,
  "tagIds"
>;

/** Update PAGE / POST */
export const PageUpdateSchema = yup.object({
  type: yup.mixed<"PAGE" | "POST">().oneOf(["PAGE", "POST"]).optional(),
  status: yup
    .mixed<"DRAFT" | "PUBLISHED">()
    .oneOf(["DRAFT", "PUBLISHED"])
    .optional(),
  slug: yup.string().trim().min(1).optional(),
  title: yup.string().trim().min(1).optional(),
  excerpt: yup.string().optional(),
  content: yup.string().optional(),

  tagIds: TagIdsSchema.optional(),
});

export type PageUpdateInput = Omit<
  yup.InferType<typeof PageUpdateSchema>,
  "tagIds"
>;
