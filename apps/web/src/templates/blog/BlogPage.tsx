import { ContentArticle } from "@/components/ContentArticle";

import type { ComponentProps } from "react";

export function BlogPage({
  content: page,
  children,
}: {
  content: Pick<ComponentProps<typeof ContentArticle>, "title" | "content">;
  children?: ComponentProps<typeof ContentArticle>["children"];
}) {
  return (
    <ContentArticle title={page.title} content={page.content}>
      {children}
    </ContentArticle>
  );
}
