import { notFound, redirect } from "next/navigation";

import { parsePostsPage } from "@/lib/content/post-archive";
import { getPublishedTaxonomyPosts } from "@/lib/content/public-content.server";
import { publicTaxonomyPath } from "@/lib/content/routes";
import { getPublicSiteSettings } from "@/lib/settings/public-site-settings.server";
import { contentMetadata } from "@/lib/settings/seo";
import { resolveWebsiteAppearance } from "@/lib/website-appearance";

type TaxonomyArchiveProps = {
  type: "CATEGORY" | "TAG";
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

async function readArchive({
  type,
  params,
  searchParams,
}: TaxonomyArchiveProps) {
  const [{ slug }, query, settings] = await Promise.all([
    params,
    searchParams,
    getPublicSiteSettings(),
  ]);
  const page = parsePostsPage(query.page, settings.postsPerPage);
  const batch = await getPublishedTaxonomyPosts(
    type,
    slug,
    settings.postsPerPage,
    (page - 1) * settings.postsPerPage,
  );

  if (!batch) {
    notFound();
  }

  const basePath = publicTaxonomyPath(type, slug);
  const title = `${type === "CATEGORY" ? "Category" : "Tag"}: ${batch.taxonomy.name}`;

  return { batch, page, settings, basePath, title };
}

export async function taxonomyArchiveMetadata(props: TaxonomyArchiveProps) {
  const { title, page, basePath } = await readArchive(props);

  return contentMetadata(
    title,
    page > 1 ? `${basePath}?page=${page}` : basePath,
  );
}

export async function TaxonomyArchive(props: TaxonomyArchiveProps) {
  const { batch, page, settings, basePath, title } = await readArchive(props);

  if (page > 1 && batch.posts.length === 0) {
    redirect(basePath);
  }

  const { views, listVariant } = resolveWebsiteAppearance(settings.appearance);
  const { Archive } = views;

  return (
    <Archive
      title={title}
      basePath={basePath}
      posts={batch.posts}
      page={page}
      hasMore={batch.hasMore}
      postsPerPage={settings.postsPerPage}
      listingMode="PAGINATION"
      listVariant={listVariant}
    />
  );
}
