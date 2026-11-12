import Link from "next/link";
import { notFound } from "next/navigation";

import { ContentArticle } from "@/components/ContentArticle";
import { PageDocument } from "@/components/PageDocument";
import { PostMetadata } from "@/components/public-content/PostMetadata";
import { getPublishedPost } from "@/lib/content/public-content.server";
import { contentMetadata } from "@/lib/settings/seo";

import styles from "./page.module.css";

import type { Metadata } from "next";

type PostPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);

  return post
    ? contentMetadata(post.title, `/posts/${post.slug}`, post.summary)
    : {};
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);

  if (!post) notFound();

  return (
    <ContentArticle
      kind="posts"
      title={post.title}
      content={post.content}
      navigation={
        <nav aria-label="Post navigation">
          <Link href="/posts">All posts</Link>
        </nav>
      }
      intro={
        <>
          <PostMetadata
            publishedAt={post.publishedAt}
            author={post.author}
            taxonomies={post.taxonomies}
          />
          {post.summary ? (
            <p className={styles.summary}>{post.summary}</p>
          ) : null}
        </>
      }
    >
      {post.pageDocument && <PageDocument document={post.pageDocument} />}
    </ContentArticle>
  );
}
