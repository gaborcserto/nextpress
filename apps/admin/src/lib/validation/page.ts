import { ContentLayoutSchema, ContentSlugSchema, EMPTY_RICH_CONTENT, SerializedRichContentSchema } from "@nextpress/shared/content";
import { z } from "zod";

import { TagIdsSchema } from "./tag"

const MAX_PAGE = 10_000;
const MAX_PAGE_SIZE = 100;

export function parsePagination(searchParams: URLSearchParams) {
  if (searchParams.getAll("page").length > 1 || searchParams.getAll("limit").length > 1) return null;
  const pageValue = searchParams.get("page");
  const limitValue = searchParams.get("limit");
  if ((pageValue !== null && !/^\d+$/.test(pageValue)) || (limitValue !== null && !/^\d+$/.test(limitValue))) return null;
  const page = pageValue === null ? 1 : Number(pageValue);
  const limit = limitValue === null ? 50 : Number(limitValue);

  if (
    !Number.isSafeInteger(page) || page < 1 || page > MAX_PAGE ||
    !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE
  ) return null;

  return { page, limit };
}

/** Create PAGE / POST */
export const PageSchema = z.object({
  type: z.enum(["PAGE", "POST"]),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  slug: ContentSlugSchema,
  title: z.string().trim().min(1).max(300),
  excerpt: SerializedRichContentSchema.pipe(z.string().max(10_000)).default(EMPTY_RICH_CONTENT),
  content: SerializedRichContentSchema.default(EMPTY_RICH_CONTENT),
  layout: ContentLayoutSchema.optional(),
  inHeaderMenu: z.boolean().optional(),
  inFooterMenu: z.boolean().optional(),
  publishedAt: z.iso.datetime({ offset: true }).nullable().optional(),

  tagIds: TagIdsSchema,
});

export type PageCreateInput = Omit<z.infer<typeof PageSchema>, "tagIds">;

/** Update PAGE / POST */
export const PageUpdateSchema = z.object({
  type: z.enum(["PAGE", "POST"]).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  slug: ContentSlugSchema.optional(),
  title: z.string().trim().min(1).max(300).optional(),
  excerpt: SerializedRichContentSchema.pipe(z.string().max(10_000)).optional(),
  content: SerializedRichContentSchema.optional(),
  layout: ContentLayoutSchema.optional(),
  inHeaderMenu: z.boolean().optional(),
  inFooterMenu: z.boolean().optional(),
  publishedAt: z.iso.datetime({ offset: true }).nullable().optional(),

  tagIds: TagIdsSchema.removeDefault().optional(),
});

export type PageUpdateInput = Omit<
  z.infer<typeof PageUpdateSchema>,
  "tagIds"
>;
