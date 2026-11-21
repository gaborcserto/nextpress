import { notFound, redirect } from "next/navigation";

import { PageDocument } from "@/components/PageDocument";
import { PostCover } from "@/components/public-content/PostCover";
import { PublishedPage } from "@/components/public-content/PublishedPage";
import { PublicWebsiteShell } from "@/components/public-shell/PublicWebsiteShell";
import { RichContent } from "@/components/RichContent";
import { parsePostsPage } from "@/lib/content/post-archive";
import {
  getPagePosts,
  getPublishedPage,
} from "@/lib/content/public-content.server";
import { LocalizedDate } from "@/lib/i18n/client";
import { localizedHref } from "@/lib/i18n/routing";
import { getLocale } from "@/lib/i18n/server";
import { getPublicSiteSettings } from "@/lib/settings/public-site-settings.server";
import { contentMetadata } from "@/lib/settings/seo";
import { resolveWebsiteAppearance } from "@/lib/website-appearance";

import type { Metadata } from "next";

type SearchParams = Promise<{ page?: string | string[] }>;

export async function PageMetadata(
  slug: string,
  searchParams?: SearchParams,
  path?: string,
): Promise<Metadata> {
  const page = path
    ? await getPublishedPage(slug, path)
    : await getPublishedPage(slug);

  let canonicalPath = page?.canonicalPath ?? `/pages/${slug}`;

  if (page?.pageType === "posts") {
    const settings = await getPublicSiteSettings();

    const number = parsePostsPage(
      (await searchParams)?.page,
      settings.postsPerPage,
    );

    if (number > 1) {
      canonicalPath += `?page=${number}`;
    }
  }

  return page
    ? contentMetadata(
        page.title,
        canonicalPath,
        page.summary,
        await getLocale(),
      )
    : {};
}

export async function RenderPublishedPage(
  slug: string,
  searchParams?: SearchParams,
  path?: string,
) {
  const page = path
    ? await getPublishedPage(slug, path)
    : await getPublishedPage(slug);

  if (!page) {
    notFound();
  }

  const settings = await getPublicSiteSettings();

  if (page.pageType !== "posts") {
    return <PublishedPage page={page} settings={settings} />;
  }

  const basePath = page.canonicalPath ?? `/pages/${page.slug}`;
  const pageNumber = parsePostsPage(
    (await searchParams)?.page,
    settings.postsPerPage,
  );

  const batch = await getPagePosts(
    page,
    settings.postsPerPage,
    (pageNumber - 1) * settings.postsPerPage,
  );

  if (pageNumber > 1 && !batch?.posts.length) {
    redirect(localizedHref(basePath, await getLocale()));
  }

  const appearance = resolveWebsiteAppearance(settings.appearance);
  const { Archive } = appearance.views;

  return (
    <PublicWebsiteShell>
      <Archive
        title={page.title}
        basePath={basePath}
        pageSlug={page.slug}
        posts={batch?.posts ?? []}
        page={pageNumber}
        hasMore={batch?.hasMore ?? false}
        postsPerPage={settings.postsPerPage}
        listingMode={settings.postListingMode}
        listVariant={appearance.listVariant}
      >
        <PostCover title={page.title} cover={page.cover} />
        <LocalizedDate value={page.publishedAt} />
        <RichContent content={page.content} />
        {page.pageDocument && (
          <PageDocument
            document={page.pageDocument}
            gifMediaIds={page.gifMediaIds}
          />
        )}
      </Archive>
    </PublicWebsiteShell>
  );
}
