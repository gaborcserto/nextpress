import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "./page.module.css";
import { PostMetadata } from "@/components/public-content/PostMetadata";
import { Container } from "@/components/public-ui/Container";
import { RichContent } from "@/components/RichContent";
import { getPublishedPost } from "@/lib/content/public-content.server";
import type { Metadata } from "next";

type PostPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  return post ? { title: post.title, ...(post.summary ? { description: post.summary } : {}) } : {};
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();

  return (
    <Container className={styles.page}>
      <nav aria-label="Post navigation"><Link href="/posts">All posts</Link></nav>
      <article className={styles.article}>
        <header className={styles.header}>
          <h1>{post.title}</h1>
          <PostMetadata publishedAt={post.publishedAt} author={post.author} taxonomies={post.taxonomies} />
          {post.summary ? <p className={styles.summary}>{post.summary}</p> : null}
        </header>
        <RichContent content={post.content} />
      </article>
    </Container>
  );
}
