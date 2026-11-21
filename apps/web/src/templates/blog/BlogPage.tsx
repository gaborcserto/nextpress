import { ContentArticle } from "@/components/ContentArticle";
import { PostCover } from "@/components/public-content/PostCover";
import { LocalizedDate } from "@/lib/i18n/client";

import type { ComponentProps } from "react";

export function BlogPage({
  content: page,
  children,
}: {
  content: Pick<ComponentProps<typeof ContentArticle>, "title" | "content"> & {
    publishedAt?: string | null;
    cover?: ComponentProps<typeof PostCover>["cover"];
  };
  children?: ComponentProps<typeof ContentArticle>["children"];
}) {
  return (
    <ContentArticle
      title={page.title}
      content={page.content}
      intro={
        <>
          <PostCover title={page.title} cover={page.cover} />
          {page.publishedAt && <LocalizedDate value={page.publishedAt} />}
        </>
      }
    >
      {children}
    </ContentArticle>
  );
}
