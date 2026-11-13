import { PostList } from "@/components/public-content/PostList";
import { TagLinks } from "@/components/public-content/TagLinks";
import { Container } from "@/components/public-ui/Container";

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
      <h1 className={styles.pageTitle}>Latest from the publication</h1>
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
            Latest post
          </h2>
          <PostList posts={[latestPost]} variant={listVariant} />
        </section>
      ) : (
        <p className={styles.empty}>There are no published posts yet.</p>
      )}
      <div className={styles.recent} data-blog-home-support>
        <section aria-labelledby="recent-title">
          <h2
            className={`${headingStyles.heading} ${styles.sectionLabel}`}
            id="recent-title"
          >
            Recent posts
          </h2>
          {recentPosts.length > 0 ? (
            <PostList posts={recentPosts} variant={listVariant} />
          ) : null}
          <div className={styles.archiveLink}>
            <BlogEditorialLink href="/posts" arrow>
              All posts
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
              Tags
            </h2>
            <TagLinks tags={tagBatch.tags} />
            {tagBatch.hasMore ? (
              <div className={styles.archiveLink}>
                <BlogEditorialLink href="/tags">All tags</BlogEditorialLink>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </Container>
  );
}
