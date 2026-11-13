import { notFound } from "next/navigation";

import { PageDocument } from "@/components/PageDocument";
import { PublicWebsiteShell } from "@/components/public-shell/PublicWebsiteShell";
import {
  getPublishedPost,
  getPublishedPosts,
} from "@/lib/content/public-content.server";
import { getPublicSiteSettings } from "@/lib/settings/public-site-settings.server";
import { contentMetadata } from "@/lib/settings/seo";
import { resolveWebsiteAppearance } from "@/lib/website-appearance";

import type { Metadata } from "next";

type PostPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);

  return post
    ? contentMetadata(post.title, `/posts/${post.slug}`, post.summary)
    : {};
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);

  if (!post) {
    notFound();
  }

  const [settings, additional] = await Promise.all([
    getPublicSiteSettings(),
    getPublishedPosts({ limit: 5 }),
  ]);
  const appearance = resolveWebsiteAppearance(settings.appearance);
  const { Post } = appearance.views;

  return (
    <PublicWebsiteShell>
      <Post content={post} additionalPosts={additional.posts}>
        {post.pageDocument && <PageDocument document={post.pageDocument} />}
      </Post>
    </PublicWebsiteShell>
  );
}
