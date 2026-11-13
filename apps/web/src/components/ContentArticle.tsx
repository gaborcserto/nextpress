import { Container } from "@/components/public-ui/Container";
import { RichContent } from "@/components/RichContent";

import pageStyles from "./ContentArticlePage.module.css";
import postStyles from "./ContentArticlePost.module.css";

import type { RichDocument } from "@nextpress/shared/content";
import type { ReactNode } from "react";

export function ContentArticle({
  kind = "pages",
  intro,
  navigation,
  title,
  content,
  children,
}: {
  kind?: "pages" | "posts";
  intro?: ReactNode;
  navigation?: ReactNode;
  title: string;
  content: RichDocument | string;
  children?: ReactNode;
}) {
  const styles = kind === "posts" ? postStyles : pageStyles;

  return (
    <Container className={styles.page}>
      {navigation}
      <article className={styles.article}>
        <header className={styles.header}>
          <h1>{title}</h1>
          {intro}
        </header>
        <RichContent
          content={content}
          className={kind === "posts" ? styles.content : undefined}
        />
        {children}
      </article>
    </Container>
  );
}
