import pageStyles from "@/app/pages/[slug]/page.module.css";
import postStyles from "@/app/posts/[slug]/page.module.css";
import { Container } from "@/components/public-ui/Container";
import { RichContent } from "@/components/RichContent";

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
        <RichContent content={content} />
        {children}
      </article>
    </Container>
  );
}
