import { CompactPostList } from "@/components/public-content/CompactPostList";
import { PostTaxonomies } from "@/components/public-content/PostTaxonomies";

import headingStyles from "./BlogHeading.module.css";
import styles from "./BlogPostFooter.module.css";

import type { PostProps } from "../types";

export function BlogPostFooter({
  post,
  additionalPosts,
}: {
  post: PostProps["content"];
  additionalPosts: NonNullable<PostProps["additionalPosts"]>;
}) {
  const articles = [
    ...new Map(
      additionalPosts
        .filter(({ slug }) => slug !== post.slug)
        .map((article) => [article.slug, article]),
    ).values(),
  ]
    .sort(
      (left, right) =>
        Date.parse(right.publishedAt) - Date.parse(left.publishedAt) ||
        left.slug.localeCompare(right.slug, "en"),
    )
    .slice(0, 4);

  if (post.taxonomies.length === 0 && articles.length === 0) {
    return null;
  }

  return (
    <footer className={styles.footer}>
      <PostTaxonomies taxonomies={post.taxonomies} />
      {articles.length > 0 ? (
        <section
          aria-labelledby="more-articles-title"
          className={styles.discovery}
        >
          <h2
            className={`${headingStyles.heading} ${styles.sectionLabel}`}
            id="more-articles-title"
          >
            More articles
          </h2>
          <CompactPostList posts={articles} className={styles.articles} />
        </section>
      ) : null}
    </footer>
  );
}
