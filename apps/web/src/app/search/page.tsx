import { PublicSearchResultSchema } from "@nextpress/shared/api-contracts";

import { PublicWebsiteShell } from "@/components/public-shell/PublicWebsiteShell";
import { fetchPublic } from "@/lib/content/public-api.server";
import { parseSearchParams, searchHref } from "@/lib/content/search";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/server";
import { getPublicSiteSettings } from "@/lib/settings/public-site-settings.server";
import { resolveWebsiteAppearance } from "@/lib/website-appearance";

export async function generateMetadata() {
  return {
    title: getMessages(await getLocale()).search.results,
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseSearchParams(await searchParams);
  const settings = await getPublicSiteSettings();
  const data = await fetchPublic(
    searchHref(query).slice(1),
    PublicSearchResultSchema,
  );
  const { Search } = resolveWebsiteAppearance(settings.appearance).views;

  return (
    <PublicWebsiteShell>
      <Search query={query} data={data} />
    </PublicWebsiteShell>
  );
}
