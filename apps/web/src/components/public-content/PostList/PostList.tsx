import { resolvePostListTemplate } from "./templates";

import type { PublicPostSummary } from "@/lib/content/public-content.server";

export type PostListVariant = "default" | "compact";

export function PostList({
  posts,
  variant,
  showTaxonomies = true,
}: {
  posts: PublicPostSummary[];
  variant: PostListVariant;
  showTaxonomies?: boolean;
}) {
  const Template = resolvePostListTemplate(variant).render;

  return <Template posts={posts} showTaxonomies={showTaxonomies} />;
}
