import { ContentSlugSchema } from "@nextpress/shared/content";

/** Namespaced URLs keep CMS slugs separate from framework and application routes. */
export function publicContentPath(type: "PAGE" | "POST", slug: string): string {
  return `/${type === "POST" ? "posts" : "pages"}/${ContentSlugSchema.parse(slug)}`;
}
