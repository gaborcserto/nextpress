import { PublicContentIndexSchema } from "@nextpress/shared/api-contracts";

import { fetchPublic } from "@/lib/content/public-api.server";
import { siteOrigin } from "@/lib/settings/seo";

import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  const entries: MetadataRoute.Sitemap = [
    "/en/",
    "/en/posts",
    "/en/tags",
    "/hu/",
    "/hu/posts",
    "/hu/tags",
  ].map((pathname) => ({
    url: new URL(pathname, origin).href,
  }));

  for (let offset = 0; offset <= 10000; offset += 100) {
    const batch = await fetchPublic(
      `content?limit=100&offset=${offset}`,
      PublicContentIndexSchema,
    );
    entries.push(
      ...batch.items.map((item) => ({
        url: new URL(
          `/en/${item.type === "POST" ? "posts" : "pages"}/${item.slug}`,
          origin,
        ).href,
        lastModified: item.updatedAt,
      })),
    );
    if (!batch.hasMore) return entries;
  }
  throw new Error("Sitemap exceeds the supported content index window");
}
