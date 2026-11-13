import { publicContentPath } from "@/lib/content/routes";
import { LocaleLink as Link, UiText } from "@/lib/i18n/client";

import styles from "./post-list.module.css";
import { PostTaxonomies } from "./PostTaxonomies";

import type { PublicPostSummary } from "@/lib/content/public-content.server";

/** An index rather than article previews; it uses the same delivery DTO. */
export function CompactPostList({
  posts,
  showTaxonomies = true,
  className,
}: {
  posts: PublicPostSummary[];
  showTaxonomies?: boolean;
  className?: string;
}) {
  if (posts.length === 0) {
    return (
      <p className={styles.empty}>
        <UiText id="posts.empty" />
      </p>
    );
  }

  return (
    <ol className={[styles.compact, className].filter(Boolean).join(" ")}>
      {posts.map((post) => (
        <li key={post.slug}>
          <h3>
            <Link href={publicContentPath("POST", post.slug)}>
              {post.title}
            </Link>
          </h3>
          <time dateTime={post.publishedAt}>
            {post.publishedAt.slice(0, 10)}
          </time>
          <PostTaxonomies taxonomies={showTaxonomies ? post.taxonomies : []} />
        </li>
      ))}
    </ol>
  );
}
