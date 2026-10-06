import { notFound } from "next/navigation";


import styles from "./page.module.css";
import { Container } from "@/components/public-ui/Container";
import { RichContent } from "@/components/RichContent";
import { getPublishedPage } from "@/lib/content/public-content.server";
import type { Metadata } from "next";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  return page ? { title: page.title, ...(page.summary ? { description: page.summary } : {}) } : {};
}

export default async function StaticPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  if (!page) notFound();

  return (
    <Container className={styles.page}>
      <article className={styles.article}>
        <header className={styles.header}>
          <h1>{page.title}</h1>
        </header>
        <RichContent content={page.content} />
      </article>
    </Container>
  );
}
