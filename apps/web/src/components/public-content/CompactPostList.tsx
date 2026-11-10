import Link from "next/link";

import { publicContentPath } from "@/lib/content/routes";

import styles from "./post-list.module.css";

import type { PublicPostSummary } from "@/lib/content/public-content.server";

/** An index rather than article previews; it uses the same delivery DTO. */
export function CompactPostList({ posts }: { posts: PublicPostSummary[] }) {
  if (posts.length === 0)
    return <p className={styles.empty}>There are no published posts yet.</p>;

  return (
    <ol className={styles.compact}>
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
        </li>
      ))}
    </ol>
  );
}
