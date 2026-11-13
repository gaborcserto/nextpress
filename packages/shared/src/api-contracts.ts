import { z } from "zod";

import { PublicAppearanceSchema } from "./appearance";
import {
  ContentLayoutSchema,
  ContentSlugSchema,
  EMPTY_RICH_CONTENT,
  SerializedRichContentSchema,
  RichBlocksSchema,
  RichDocumentSchema,
} from "./content";
import { PageDocumentSchema } from "./page-document";
import {
  PostListingModeSchema,
  MAX_POSTS_PER_PAGE,
  MAX_POSTS_OFFSET,
  DEFAULT_POSTS_PER_PAGE,
} from "./post-listing-settings";

export const TagIdsSchema = z
  .array(z.string().trim().min(1).max(64))
  .max(100, "At most 100 tags may be assigned")
  .refine(
    (ids) => new Set(ids).size === ids.length,
    "Duplicate tag IDs are not allowed",
  )
  .default([]);

export const TagCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
});

/** Create PAGE / POST */
export const PageSchema = z.object({
  type: z.enum(["PAGE", "POST"]),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  slug: ContentSlugSchema,
  title: z.string().trim().min(1).max(300),
  excerpt: SerializedRichContentSchema.pipe(z.string().max(10_000)).default(
    EMPTY_RICH_CONTENT,
  ),
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
  expectedVersion: z.number().int().min(0).max(2_147_483_646),
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

export type PageUpdateInput = Omit<z.infer<typeof PageUpdateSchema>, "tagIds">;

export const ApiErrorSchema = z.object({
  error: z.string(),
  issues: z
    .array(z.object({ path: z.string().nullable(), message: z.string() }))
    .optional(),
});
export const TagSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});
export const TagWithUsageSchema = TagSchema.extend({
  usedCount: z.number().int().nonnegative(),
});
const date = z.iso.datetime({ offset: true });
const nullableString = z.string().nullable();
const editorialFields = {
  workingVersion: z.number().int().nonnegative(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  slug: z.string(),
  title: z.string(),
  content: RichBlocksSchema,
  tags: z.array(TagSchema),
};
const listingKind = z.enum(["POSTS", "PRODUCTS", "EVENTS"]).nullable();
export const EditorialPostSchema = z.object({
  ...editorialFields,
  excerpt: RichBlocksSchema,
  publishedAt: date.nullable(),
  cover: z
    .object({ id: z.string(), url: z.string(), alt: nullableString })
    .nullable(),
});
export const EditorialPageSchema = z.object({
  ...editorialFields,
  type: ContentLayoutSchema,
  parentId: nullableString,
  inHeaderMenu: z.boolean(),
  inFooterMenu: z.boolean(),
  listingKind,
  listingTaxonomyId: nullableString,
  eventStart: date.nullable(),
  eventEnd: date.nullable(),
  eventLocation: nullableString,
  registrationUrl: nullableString,
  redirectTo: nullableString,
});
export type EditorialPost = z.infer<typeof EditorialPostSchema>;
export type EditorialPage = z.infer<typeof EditorialPageSchema>;
export const ContentListSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["PAGE", "POST"]),
      status: z.enum(["DRAFT", "PUBLISHED"]),
      slug: z.string(),
      title: z.string(),
      excerpt: nullableString,
      updatedAt: date,
    }),
  ),
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  pages: z.number().int(),
});
export const ContentRecordSchema = z.object({
  workingVersion: z.number().int().nonnegative(),
  id: z.string(),
  type: z.enum(["PAGE", "POST"]),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  slug: z.string(),
  title: z.string(),
  excerpt: nullableString,
  content: z.string(),
  layout: ContentLayoutSchema,
  coverId: nullableString,
  authorId: nullableString,
  publishedAt: date.nullable(),
  inHeaderMenu: z.boolean(),
  inFooterMenu: z.boolean(),
  parentId: nullableString,
  listingKind,
  listingTaxonomyId: nullableString,
  eventStart: date.nullable(),
  eventEnd: date.nullable(),
  eventLocation: nullableString,
  registrationUrl: nullableString,
  redirectTo: nullableString,
  viewCount: z.number().int(),
  uniqueViewCount: z.number().int(),
  likeCount: z.number().int(),
  lastViewedAt: date.nullable(),
  createdAt: date,
  updatedAt: date,
});
export const PublicCoverSchema = z
  .strictObject({
    url: z.string().regex(/^\/(?!\/)/),
    alt: z.string(),
    width: z.number().int().nullable(),
    height: z.number().int().nullable(),
  })
  .nullable();

export const PublicTaxonomySchema = z.strictObject({
  type: z.enum(["TAG", "CATEGORY"]),
  slug: z.string(),
  name: z.string(),
});
export const PublicTaxonomyParamsSchema = z.strictObject({
  type: z.enum(["TAG", "CATEGORY"]),
  slug: z
    .string()
    .refine((slug) => slug === slug.trim())
    .pipe(ContentSlugSchema),
});

const publicSummary = {
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  publishedAt: date,
  author: z.strictObject({ name: z.string() }).nullable(),
  taxonomies: z.array(PublicTaxonomySchema),
};
export const PublicPostSummarySchema = z.strictObject({
  ...publicSummary,
  cover: PublicCoverSchema.optional(),
});
export const PublicContentSchema = z.strictObject({
  pageDocument: PageDocumentSchema.nullable().optional(),
  ...publicSummary,
  content: RichDocumentSchema,
  cover: PublicCoverSchema,
});

export const PublicContentIndexQuerySchema = z.object({
  kind: z.enum(["PAGE", "POST"]).optional(),
  taxonomyId: z.string().min(1).max(128).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
});
export const PublicContentIndexSchema = z.strictObject({
  items: z.array(
    z.strictObject({
      type: z.enum(["PAGE", "POST"]),
      slug: ContentSlugSchema,
      title: z.string(),
      updatedAt: z.iso.datetime(),
    }),
  ),
  hasMore: z.boolean(),
});
export const PublicPostBatchSchema = z.strictObject({
  posts: z.array(PublicPostSummarySchema),
  hasMore: z.boolean(),
});
export const PublicTaxonomyBatchSchema = PublicPostBatchSchema.extend({
  taxonomy: PublicTaxonomySchema,
});
export const PublicTagBatchSchema = z.strictObject({
  tags: z
    .array(
      PublicTaxonomySchema.extend({
        type: z.literal("TAG"),
        slug: PublicTaxonomyParamsSchema.shape.slug,
      }),
    )
    .max(MAX_POSTS_PER_PAGE),
  hasMore: z.boolean(),
});
const navigationItem = z.strictObject({ slug: z.string(), title: z.string() });
export const PublicNavigationSchema = z.strictObject({
  header: z.array(navigationItem),
  footer: z.array(navigationItem),
});
export const PublicSiteSettingsSchema = z.strictObject({
  appearance: PublicAppearanceSchema.optional(),
  siteName: z.string(),
  siteDescription: z.string(),
  postListingMode: PostListingModeSchema,
  postsPerPage: z.number().int().min(1).max(MAX_POSTS_PER_PAGE),
});
export const PublicPaginationSchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_POSTS_PER_PAGE)
    .default(DEFAULT_POSTS_PER_PAGE),
  offset: z.coerce.number().int().min(0).max(MAX_POSTS_OFFSET).default(0),
});
export const SessionDiscoverySchema = z.strictObject({
  user: z
    .strictObject({
      id: z.string(),
      name: z.string().nullable(),
      role: z.enum(["ADMIN", "EDITOR", "AUTHOR", "SUBSCRIBER"]).nullable(),
    })
    .nullable(),
});
export const ProviderDiscoverySchema = z.strictObject({
  providers: z.array(
    z.enum(["apple", "discord", "facebook", "github", "google", "twitter"]),
  ),
});

export const PublicSearchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(200)
    .transform((value) => value.replace(/\s+/g, " "))
    .default(""),
  type: z.enum(["all", "posts", "pages"]).default("all"),
  sort: z.enum(["relevance", "newest"]).default("relevance"),
  category: ContentSlugSchema.optional(),
  tag: ContentSlugSchema.optional(),
  page: z.coerce.number().int().min(1).max(100).default(1),
});

export const PublicSearchResultSchema = z.object({
  results: z
    .array(PublicPostSummarySchema.extend({ type: z.enum(["POST", "PAGE"]) }))
    .max(10),
  total: z.number().int().nonnegative(),
  taxonomies: z.array(PublicTaxonomySchema),
});
