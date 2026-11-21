import { z } from "zod";

export const MediaMetadataSchema = z.object({
  id: z.string(),
  url: z.string(),
  alt: z.string().nullable(),
  mime: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
});

export const MediaIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
export const maxGalleryImages = 48;
export const GalleryIdsSchema = z
  .array(MediaIdSchema)
  .max(maxGalleryImages)
  .refine(
    (ids) => new Set(ids).size === ids.length,
    "Duplicate gallery images",
  );
export const EditorImageSchema = z.object({
  id: MediaIdSchema,
  url: z.string(),
  mime: z.string().optional(),
  alt: z.string().nullable().optional(),
  width: z.number().int().nullable().optional(),
  height: z.number().int().nullable().optional(),
  filename: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
});
export type EditorImage = z.infer<typeof EditorImageSchema>;
export const GalleryImageSchema = EditorImageSchema.omit({
  filename: true,
  mime: true,
}).extend({
  gif: z.literal(true).optional(),
  url: z.string().regex(/^\/media\/[a-zA-Z0-9_-]{1,128}$/),
});
export type GalleryImage = z.infer<typeof GalleryImageSchema>;
export const MediaInputMimeSchema = z.enum([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "image/gif",
]);
export type MediaInputMime = z.infer<typeof MediaInputMimeSchema>;
export const documentMime = "application/pdf";
export const maxDocumentUploadBytes = 10 * 1024 * 1024;
export const maxStoredMediaBytes = 8_388_608;
export const maxMediaUploadBytes = 2_097_152;

const plainText = (limit: number) =>
  z
    .string()
    .trim()
    .max(limit)
    .refine(
      (value) => !value.includes("\0"),
      "Text must not contain null characters",
    );

export const MediaEditSchema = z.strictObject({
  alt: plainText(500).nullable(),
  caption: plainText(500).nullable(),
  description: plainText(2000).nullable(),
});

export const MediaAssetSchema = MediaMetadataSchema.extend({
  filename: z.string().nullable(),
  originalMime: z.string().nullable(),
  size: z.number().int().nullable(),
  caption: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().nullable(),
});

export const MediaDetailsSchema = MediaAssetSchema.extend({
  inUse: z.boolean().nullable(),
  uploadedById: z.string().nullable().optional(),
  publiclyAvailable: z.boolean().optional(),
});

export const MediaBrowseSchema = z.strictObject({
  q: plainText(100).optional(),
  mime: MediaInputMimeSchema.optional(),
  sort: z
    .enum(["createdAt", "updatedAt", "filename", "size"])
    .default("createdAt"),
  direction: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
});

export const DocumentBrowseSchema = MediaBrowseSchema.omit({ mime: true });

export const DocumentFilenameSchema = z
  .string()
  .trim()
  .min(5)
  .max(255)
  .refine(
    (value) =>
      value.toLowerCase().endsWith(".pdf") &&
      !/[<>:"/\\|?*\p{Cc}\p{Cf}\p{Cs}]/u.test(value),
  );

export const MediaCollectionSchema = z.object({
  items: z.array(MediaAssetSchema),
  hasMore: z.boolean(),
});

export type MediaAsset = z.infer<typeof MediaAssetSchema>;
export type MediaDetails = z.infer<typeof MediaDetailsSchema>;
export type MediaBrowse = z.infer<typeof MediaBrowseSchema>;
export type MediaEdit = z.infer<typeof MediaEditSchema>;

export const MediaUploadSchema = z.strictObject({
  data: z
    .string()
    .min(4)
    .max(2_800_000)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  mime: MediaInputMimeSchema,
  alt: MediaEditSchema.shape.alt,
  filename: z.string().trim().min(1).max(255).optional(),
});
