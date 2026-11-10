import { publicAppearance } from "@/lib/appearance";

import { resolvePostListTemplate } from "./templates";

import type { PublicPostSummary } from "@/lib/content/public-content.server";

export function PostList({ posts }: { posts: PublicPostSummary[] }) {
  const Template = resolvePostListTemplate(publicAppearance.template).render;

  return <Template posts={posts} />;
}
