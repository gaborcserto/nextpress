import { PublicTaxonomyParamsSchema } from "@nextpress/shared/api-contracts";
import { ContentSlugSchema } from "@nextpress/shared/content";

/** Namespaced URLs keep CMS slugs separate from framework and application routes. */
export function publicContentPath(type: "PAGE" | "POST", slug: string): string {
  return `/${type === "POST" ? "posts" : "pages"}/${ContentSlugSchema.parse(slug)}`;
}

export function publicTaxonomyPath(
  type: "CATEGORY" | "TAG",
  slug: string,
): string {
  const taxonomy = PublicTaxonomyParamsSchema.parse({ type, slug });

  return `/${taxonomy.type === "CATEGORY" ? "categories" : "tags"}/${taxonomy.slug}`;
}
