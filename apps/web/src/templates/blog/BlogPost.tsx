import { pageMediaIds } from "@nextpress/shared/page-document";

import { ContentArticle } from "@/components/ContentArticle";
import styles from "@/components/ContentArticlePost.module.css";
import { PostCover } from "@/components/public-content/PostCover";
import { PostMetadata } from "@/components/public-content/PostMetadata";
import { UiNav, UiText } from "@/lib/i18n/client";

import { BlogEditorialLink } from "./BlogEditorialLink";
import { BlogPostFooter } from "./BlogPostFooter";

import type { PostProps } from "../types";

export function BlogPost({
  content: post,
  children,
  additionalPosts = [],
}: PostProps) {
  const coverAlreadyAuthored =
    post.pageDocument &&
    pageMediaIds(post.pageDocument).some(
      (id) => post.cover?.url === `/media/${id}`,
    );

  return (
    <ContentArticle
      kind="posts"
      title={post.title}
      content={post.content}
      navigation={
        <UiNav label="accessibility.postNavigation">
          <BlogEditorialLink href="/posts" arrow>
            <UiText id="posts.all" />
          </BlogEditorialLink>
        </UiNav>
      }
      intro={
        <>
          <PostMetadata publishedAt={post.publishedAt} author={post.author} />
          {post.summary ? (
            <p className={styles.summary}>{post.summary}</p>
          ) : null}
          {coverAlreadyAuthored ? null : (
            <PostCover cover={post.cover} title={post.title} />
          )}
        </>
      }
    >
      {children}
      <BlogPostFooter post={post} additionalPosts={additionalPosts} />
    </ContentArticle>
  );
}
