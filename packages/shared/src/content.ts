import { z } from "zod";

export const ContentSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase words separated by single hyphens",
  );

export const pageLayouts = {
  standard: "STANDARD",
  home: "HOME",
  posts: "POSTS",
  gallery: "GALLERY",
} as const;

export const PageTypeSchema = z.enum(["standard", "home", "posts", "gallery"]);
export type PageType = z.infer<typeof PageTypeSchema>;

export function resolvePageType(layout: ContentLayout): PageType {
  switch (layout) {
    case pageLayouts.home:
      return "home";
    case pageLayouts.posts:
      return "posts";
    case pageLayouts.gallery:
      return "gallery";
    default:
      return "standard";
  }
}

export const ContentLayoutSchema = z.enum([
  pageLayouts.standard,
  pageLayouts.home,
  pageLayouts.posts,
  pageLayouts.gallery,
  "HOMEPAGE",
  "LISTING",
  "CONTACT",
  "LANDING",
  "REDIRECT",
  "DOWNLOAD",
  "CATEGORY_PAGE",
  "EVENT_PAGE",
]);

export type ContentLayout = z.infer<typeof ContentLayoutSchema>;

export const RichTextSchema = z.strictObject({
  text: z.string(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strikethrough: z.boolean().optional(),
  code: z.boolean().optional(),
});

const textChildren = z.array(RichTextSchema).min(1).max(10_000);
const alignment = z.enum(["left", "center", "right", "justify"]).optional();
// Slate retains heading level when changing block type. Preserve this harmless metadata.
const level = z.union([
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);
const blockFields = {
  align: alignment,
  level: level.optional(),
  children: textChildren,
};
export const RichListItemSchema = z.strictObject({
  type: z.literal("list-item"),
  ...blockFields,
});
export const RichBlockSchema = z.union([
  z.strictObject({ type: z.literal("paragraph"), ...blockFields }),
  z.strictObject({ type: z.literal("heading"), ...blockFields, level }),
  z.strictObject({ type: z.literal("blockquote"), ...blockFields }),
  z.strictObject({ type: z.literal("code-block"), ...blockFields }),
  RichListItemSchema,
  z.strictObject({
    type: z.literal("bulleted-list"),
    align: alignment,
    children: z.array(RichListItemSchema).min(1).max(10_000),
  }),
  z.strictObject({
    type: z.literal("numbered-list"),
    align: alignment,
    children: z.array(RichListItemSchema).min(1).max(10_000),
  }),
]);
export const RichBlocksSchema = z.array(RichBlockSchema).min(1).max(10_000);
export const RichDocumentSchema = z.strictObject({
  version: z.literal(1),
  blocks: RichBlocksSchema,
});
export type RichDocument = z.infer<typeof RichDocumentSchema>;
export type RichBlock = z.infer<typeof RichBlockSchema>;
export type RichText = z.infer<typeof RichTextSchema>;

export function textDocument(text = ""): RichDocument {
  return { version: 1, blocks: [{ type: "paragraph", children: [{ text }] }] };
}

export function serializeRichContent(blocks: unknown): string {
  return JSON.stringify(RichDocumentSchema.parse({ version: 1, blocks }));
}

export const EMPTY_RICH_CONTENT = JSON.stringify(textDocument());

export const SerializedRichContentSchema = z
  .string()
  .max(1_000_000)
  .transform((value, ctx) => {
    try {
      return JSON.stringify(RichDocumentSchema.parse(JSON.parse(value)));
    } catch {
      ctx.issues.push({
        code: "custom",
        message: "Invalid rich-content document",
        input: value,
      });

      return z.NEVER;
    }
  });

/** Read compatibility only: old Slate arrays and plain text/HTML are never executed as HTML. */
export function readRichContent(value: string | null): RichDocument {
  if (!value) {
    return textDocument();
  }

  if (value.length > 1_000_000) {
    throw new Error("Invalid rich-content document");
  }

  const trimmed = value.trimStart();

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed)
      ? { version: 1, blocks: RichBlocksSchema.parse(parsed) }
      : RichDocumentSchema.parse(parsed);
  }

  return textDocument(value);
}

export function richContentText(document: RichDocument): string {
  return document.blocks
    .map((block) => {
      if (block.type === "bulleted-list" || block.type === "numbered-list") {
        return block.children
          .map((item) => item.children.map((leaf) => leaf.text).join(""))
          .join("\n");
      }

      return block.children.map((leaf) => leaf.text).join("");
    })
    .join("\n");
}

/** Public presentation omits corrupt content without relaxing the canonical write contract. */
export function parsePublicRichContent(
  content: RichDocument | string | null,
): RichDocument {
  if (typeof content === "string" || content === null) {
    try {
      return readRichContent(content);
    } catch {
      return textDocument();
    }
  }

  const result = RichDocumentSchema.safeParse(content);

  return result.success ? result.data : textDocument();
}

export const maxPageDepth = 8;
const reservedRoots = new Set([
  "api",
  "admin",
  "auth",
  "categories",
  "en",
  "hu",
  "live-preview",
  "media",
  "pages",
  "posts",
  "search",
  "tags",
]);

export function isPagePath(segments: string[]) {
  return (
    segments.length > 0 &&
    segments.length <= maxPageDepth &&
    !reservedRoots.has(segments[0] ?? "") &&
    segments.every(
      (segment) =>
        segment === segment.trim() &&
        ContentSlugSchema.safeParse(segment).success,
    )
  );
}
