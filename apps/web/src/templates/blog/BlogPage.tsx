import { ContentArticle } from "@/components/ContentArticle";

import type { DetailProps } from "../types";

export function BlogPage({ content: page, children }: DetailProps) {
  return (
    <ContentArticle title={page.title} content={page.content}>
      {children}
    </ContentArticle>
  );
}
