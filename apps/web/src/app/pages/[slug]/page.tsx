import { notFound } from "next/navigation";

import { ContentArticle } from "@/components/ContentArticle";
import { PageDocument } from "@/components/PageDocument";
import { getPublishedPage } from "@/lib/content/public-content.server";
import { contentMetadata } from "@/lib/settings/seo";

import type { Metadata } from "next";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedPage(slug);

  return page
    ? contentMetadata(page.title, `/pages/${page.slug}`, page.summary)
    : {};
}

export default async function StaticPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getPublishedPage(slug);

  if (!page) notFound();

  return (
    <ContentArticle title={page.title} content={page.content}>
      {page.pageDocument && <PageDocument document={page.pageDocument} />}
    </ContentArticle>
  );
}
