import { z } from "zod";

import { RichDocumentSchema } from "./content";

const reference = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);
const label = z.string().max(500);
const destination = z
  .string()
  .max(2048)
  .refine((value) => {
    if (/^\/(?!\/)[^\\\s]*$/.test(value)) return true;
    try {
      const url = new URL(value);

      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Use a site-relative path or HTTPS URL");
const identity = { id: reference, version: z.literal(1) };

export const PageLeafBlockSchema = z.discriminatedUnion("type", [
  z.strictObject({
    ...identity,
    type: z.literal("rich-text"),
    props: z.strictObject({ document: RichDocumentSchema }),
  }),
  z.strictObject({
    ...identity,
    type: z.literal("hero"),
    props: z.strictObject({
      title: label,
      description: z.string().max(2000),
      mediaId: reference.optional(),
    }),
  }),
  z.strictObject({
    ...identity,
    type: z.literal("image"),
    props: z.strictObject({ mediaId: reference, alt: label }),
  }),
  z.strictObject({
    ...identity,
    type: z.literal("call-to-action"),
    props: z.strictObject({ label: label.min(1), href: destination }),
  }),
  z.strictObject({
    ...identity,
    type: z.literal("content-listing"),
    props: z.strictObject({
      kind: z.enum(["POST", "PAGE"]),
      limit: z.number().int().min(1).max(50),
      taxonomyId: reference.optional(),
    }),
  }),
]);

export const PageBlockSchema = z.union([
  PageLeafBlockSchema,
  z.strictObject({
    ...identity,
    type: z.literal("columns"),
    props: z.strictObject({}),
    regions: z.array(z.array(PageLeafBlockSchema).max(20)).min(2).max(4),
  }),
]);

export const PageDocumentSchema = z
  .strictObject({
    version: z.literal(1),
    blocks: z.array(PageBlockSchema).max(100),
  })
  .superRefine((document, ctx) => {
    if (JSON.stringify(document).length > 1_000_000)
      ctx.addIssue({ code: "custom", message: "Page document is too large" });
    const ids = new Set<string>();

    for (const block of document.blocks.flatMap((block) =>
      block.type === "columns" ? [block, ...block.regions.flat()] : [block],
    )) {
      if (ids.has(block.id))
        ctx.addIssue({ code: "custom", message: "Block IDs must be unique" });
      ids.add(block.id);
    }
  });

export type PageDocument = z.infer<typeof PageDocumentSchema>;
export type PageBlock = z.infer<typeof PageBlockSchema>;

export function pageMediaIds(document: PageDocument): string[] {
  const blocks = document.blocks.flatMap((block) =>
    block.type === "columns" ? block.regions.flat() : [block],
  );

  return [
    ...new Set(
      blocks.flatMap((block) =>
        (block.type === "image" || block.type === "hero") && block.props.mediaId
          ? [block.props.mediaId]
          : [],
      ),
    ),
  ];
}

export const PAGE_DOCUMENT_CAPABILITIES = {
  documentVersion: 1,
  blocks: {
    "rich-text": 1,
    hero: 1,
    image: 1,
    "call-to-action": 1,
    columns: 1,
    "content-listing": 1,
  },
} as const;

export function serializePageDocument(value: unknown): string {
  const serialized = JSON.stringify(PageDocumentSchema.parse(value));

  if (serialized.length > 1_000_000)
    throw new Error("Page document is too large");

  return serialized;
}

/** Version 1 is the first release. Future versions require explicit migrations. */
export function migratePageDocument(value: unknown): PageDocument {
  return PageDocumentSchema.parse(value);
}

/** Preserve the original bytes for repair/export; never render unsupported data. */
export function readPageDocument(serialized: string) {
  if (serialized.length > 1_000_000)
    throw new Error("Page document is too large");
  try {
    const value: unknown = JSON.parse(serialized);
    const result = PageDocumentSchema.safeParse(value);

    if (result.success)
      return { supported: true as const, document: result.data };
  } catch {
    // Invalid stored JSON is also repairable, but cannot be rendered.
  }

  return { supported: false as const, original: serialized };
}

export function supportsPageDocument(
  document: PageDocument,
  capabilities: {
    documentVersion: number;
    blocks: Readonly<Record<string, number>>;
  },
): boolean {
  const blocks = document.blocks.flatMap((block) =>
    block.type === "columns" ? [block, ...block.regions.flat()] : [block],
  );

  return (
    capabilities.documentVersion === document.version &&
    blocks.every((block) => capabilities.blocks[block.type] === block.version)
  );
}
