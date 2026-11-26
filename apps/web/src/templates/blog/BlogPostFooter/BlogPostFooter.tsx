import { CompactPostList } from "@/components/public-content/PostList/CompactPostList";
import { PostTaxonomies } from "@/components/public-content/PostTaxonomies";
import { UiText } from "@/lib/i18n/client";

import headingStyles from "../BlogHeading.module.css";
import styles from "./BlogPostFooter.module.css";
import { selectMoreArticles } from "./BlogPostFooter.utils";

import type { PostProps } from "../../types";

export function BlogPostFooter({
  post,
  additionalPosts,
}: {
  post: PostProps["content"];
  additionalPosts: NonNullable<PostProps["additionalPosts"]>;
}) {
  const articles = selectMoreArticles(post.slug, additionalPosts);

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
            <UiText id="posts.moreArticles" />
          </h2>
          <CompactPostList posts={articles} className={styles.articles} />
        </section>
      ) : null}
    </footer>
  );
}
