import { z } from "zod";

export const MediaMetadataSchema = z.object({
  id: z.string(),
  url: z.string(),
  alt: z.string().nullable(),
  mime: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
});

export const MediaUploadSchema = z.strictObject({
  data: z
    .string()
    .min(4)
    .max(2_800_000)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  mime: z.enum(["image/png", "image/jpeg"]),
  alt: z.string().max(500),
});
