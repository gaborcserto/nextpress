import { PostList } from "@/components/public-content/PostList";
import { TagLinks } from "@/components/public-content/TagLinks";
import { Container } from "@/components/public-ui/Container";
import { UiText } from "@/lib/i18n/client";

import { BlogEditorialLink } from "./BlogEditorialLink";
import headingStyles from "./BlogHeading.module.css";
import styles from "./BlogHome.module.css";

import type { HomeProps } from "../types";

export function BlogHome({
  posts,
  listVariant,
  tagBatch = { tags: [], hasMore: false },
}: HomeProps) {
  const [latestPost, ...recentPosts] = posts;

  return (
    <Container className={styles.home} data-blog-home>
      <h1 className={styles.pageTitle}>
        <UiText id="posts.latestHeading" />
      </h1>
      {latestPost ? (
        <section
          className={styles.lead}
          data-blog-home-lead
          aria-labelledby="latest-title"
        >
          <h2
            className={`${headingStyles.heading} ${styles.sectionLabel}`}
            id="latest-title"
          >
            <UiText id="posts.latest" />
          </h2>
          <PostList posts={[latestPost]} variant={listVariant} />
        </section>
      ) : (
        <p className={styles.empty}>
          <UiText id="posts.empty" />
        </p>
      )}
      <div className={styles.recent} data-blog-home-support>
        <section aria-labelledby="recent-title">
          <h2
            className={`${headingStyles.heading} ${styles.sectionLabel}`}
            id="recent-title"
          >
            <UiText id="posts.recent" />
          </h2>
          {recentPosts.length > 0 ? (
            <PostList posts={recentPosts} variant={listVariant} />
          ) : null}
          <div className={styles.archiveLink}>
            <BlogEditorialLink href="/posts" arrow>
              <UiText id="posts.all" />
            </BlogEditorialLink>
          </div>
        </section>
        {tagBatch.tags.length > 0 ? (
          <section
            className={styles.tagsSection}
            aria-labelledby="home-tags-title"
          >
            <h2
              id="home-tags-title"
              className={`${headingStyles.heading} ${styles.sectionLabel}`}
            >
              <UiText id="taxonomy.tags" />
            </h2>
            <TagLinks tags={tagBatch.tags} />
            {tagBatch.hasMore ? (
              <div className={styles.archiveLink}>
                <BlogEditorialLink href="/tags">
                  <UiText id="taxonomy.allTags" />
                </BlogEditorialLink>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </Container>
  );
}
