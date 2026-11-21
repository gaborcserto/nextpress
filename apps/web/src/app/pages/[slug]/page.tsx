import {
  PageMetadata,
  RenderPublishedPage,
} from "@/components/public-content/RenderPublishedPage";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ page?: string | string[] }>;
};

export async function generateMetadata({ params, searchParams }: PageProps) {
  return PageMetadata((await params).slug, searchParams);
}

export default async function StaticPage({ params, searchParams }: PageProps) {
  return RenderPublishedPage((await params).slug, searchParams);
}
