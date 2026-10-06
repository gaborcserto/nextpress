import "server-only";

import { prisma, type Prisma } from "@nextpress/db";
import { ContentSlugSchema, richContentText, type RichDocument } from "@nextpress/shared/content";

import { parsePublicRichContent } from "./rich-content";

const publicContentSelect = {
  slug: true,
  title: true,
  excerpt: true,
  content: true,
  publishedAt: true,
  author: { select: { name: true } },
  taxonomies: { select: { taxonomy: { select: { type: true, slug: true, name: true } } } },
  cover: { select: { url: true, alt: true, mime: true, width: true, height: true } },
} satisfies Prisma.PageSelect;

type PublicContentRow = Prisma.PageGetPayload<{ select: typeof publicContentSelect }>;

export type PublicContent = {
  slug: string;
  title: string;
  summary: string;
  content: RichDocument;
  publishedAt: string | null;
  author: { name: string } | null;
  taxonomies: { type: "TAG" | "CATEGORY"; slug: string; name: string }[];
  cover: { url: string; alt: string; width: number | null; height: number | null } | null;
};

function projectPublicContent(row: PublicContentRow): PublicContent {
  const cover = row.cover;
  return {
    slug: row.slug,
    title: row.title,
    summary: richContentText(parsePublicRichContent(row.excerpt)),
    content: parsePublicRichContent(row.content),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    author: row.author?.name ? { name: row.author.name } : null,
    taxonomies: row.taxonomies.map(({ taxonomy }) => ({
      type: taxonomy.type, slug: taxonomy.slug, name: taxonomy.name,
    })),
    // Current public CSP allows same-origin images only. Storage keys and uploader details stay private.
    cover: cover && cover.mime.startsWith("image/") && /^\/(?!\/)/.test(cover.url)
      && !/[\\\u0000-\u0020]/.test(cover.url)
      ? { url: cover.url, alt: cover.alt ?? "", width: cover.width, height: cover.height }
      : null,
  };
}

/** No session, admin endpoint, ID fallback, or cross-request cache participates in public reads. */
export async function getPublishedContent(type: "PAGE" | "POST", slug: string): Promise<PublicContent | null> {
  if (!ContentSlugSchema.safeParse(slug).success || slug !== slug.trim()) return null;
  const row = await prisma.page.findUnique({
    where: {
      slug, type, status: "PUBLISHED",
      OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
    },
    select: publicContentSelect,
  });
  return row ? projectPublicContent(row) : null;
}
