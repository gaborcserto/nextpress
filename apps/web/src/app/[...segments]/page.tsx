import { isPagePath } from "@nextpress/shared/content";
import { notFound } from "next/navigation";

import {
  PageMetadata,
  RenderPublishedPage,
} from "@/components/public-content/RenderPublishedPage";

type NestedPageProps = {
  params: Promise<{ segments: string[] }>;
  searchParams?: Promise<{ page?: string | string[] }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: NestedPageProps) {
  const segments = (await params).segments;
  const slug = segments.at(-1);

  return slug && isPagePath(segments)
    ? PageMetadata(slug, searchParams, `/${segments.join("/")}`)
    : {};
}

export default async function NestedPage({
  params,
  searchParams,
}: NestedPageProps) {
  const segments = (await params).segments;
  const slug = segments.at(-1);

  if (!slug || !isPagePath(segments)) {
    notFound();
  }

  return RenderPublishedPage(slug, searchParams, `/${segments.join("/")}`);
}
