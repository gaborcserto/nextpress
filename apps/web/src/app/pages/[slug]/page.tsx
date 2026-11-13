import { notFound } from "next/navigation";

import { PageDocument } from "@/components/PageDocument";
import { PublicWebsiteShell } from "@/components/public-shell/PublicWebsiteShell";
import { getPublishedPage } from "@/lib/content/public-content.server";
import { getLocale } from "@/lib/i18n/server";
import { getPublicSiteSettings } from "@/lib/settings/public-site-settings.server";
import { contentMetadata } from "@/lib/settings/seo";
import { resolveWebsiteAppearance } from "@/lib/website-appearance";

import type { Metadata } from "next";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedPage(slug);

  return page
    ? contentMetadata(
        page.title,
        `/pages/${page.slug}`,
        page.summary,
        await getLocale(),
      )
    : {};
}

export default async function StaticPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getPublishedPage(slug);

  if (!page) {
    notFound();
  }

  const settings = await getPublicSiteSettings();
  const appearance = resolveWebsiteAppearance(settings.appearance);
  const { Page } = appearance.views;

  return (
    <PublicWebsiteShell>
      <Page content={page}>
        {page.pageDocument && <PageDocument document={page.pageDocument} />}
      </Page>
    </PublicWebsiteShell>
  );
}
