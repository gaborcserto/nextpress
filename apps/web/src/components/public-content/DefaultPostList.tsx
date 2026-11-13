import { publicContentPath } from "@/lib/content/routes";
import { LocaleLink as Link, UiText } from "@/lib/i18n/client";

import styles from "./post-list.module.css";
import { PostCover } from "./PostCover";
import { PostMetadata } from "./PostMetadata";
import { PostTaxonomies } from "./PostTaxonomies";

import type { PublicPostSummary } from "@/lib/content/public-content.server";

export function DefaultPostList({
  posts,
  showTaxonomies = true,
}: {
  posts: PublicPostSummary[];
  showTaxonomies?: boolean;
}) {
  if (posts.length === 0) {
    return (
      <p className={styles.empty}>
        <UiText id="posts.empty" />
      </p>
    );
  }

  return (
    <ul className={styles.list} data-post-list="default">
      {posts.map((post, index) => (
        <li className={styles.entry} key={post.slug}>
          <article>
            <PostCover
              cover={post.cover}
              title={post.title}
              eager={index === 0}
              card
            />
            <h3 className={styles.title}>
              <Link href={publicContentPath("POST", post.slug)}>
                {post.title}
              </Link>
            </h3>
            <PostMetadata publishedAt={post.publishedAt} author={post.author} />
            {post.summary ? (
              <p className={styles.summary}>{post.summary}</p>
            ) : null}
            <PostTaxonomies
              taxonomies={showTaxonomies ? post.taxonomies : []}
            />
          </article>
        </li>
      ))}
    </ul>
  );
}
