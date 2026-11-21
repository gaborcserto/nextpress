import { ContentArticle } from "@/components/ContentArticle";
import { PostCover } from "@/components/public-content/PostCover";

import type { ComponentProps } from "react";

export function BlogPage({
  content: page,
  children,
}: {
  content: Pick<ComponentProps<typeof ContentArticle>, "title" | "content"> & {
    cover?: ComponentProps<typeof PostCover>["cover"];
  };
  children?: ComponentProps<typeof ContentArticle>["children"];
}) {
  return (
    <ContentArticle
      title={page.title}
      content={page.content}
      intro={<PostCover title={page.title} cover={page.cover} />}
    >
      {children}
    </ContentArticle>
  );
}
