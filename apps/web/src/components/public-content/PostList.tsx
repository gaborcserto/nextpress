import Link from "next/link";

import styles from "./post-list.module.css";
import { PostMetadata } from "./PostMetadata";
import type { PublicPostSummary } from "@/lib/content/public-content.server";
import { publicContentPath } from "@/lib/content/routes";

export function PostList({ posts }: { posts: PublicPostSummary[] }) {
  if (posts.length === 0) {
    return <p className={styles.empty}>There are no published posts yet.</p>;
  }

  return (
    <ul className={styles.list}>
      {posts.map((post) => (
        <li className={styles.entry} key={post.slug}>
          <article>
            <h3 className={styles.title}><Link href={publicContentPath("POST", post.slug)}>{post.title}</Link></h3>
            <PostMetadata publishedAt={post.publishedAt} author={post.author} taxonomies={post.taxonomies} />
            {post.summary ? <p className={styles.summary}>{post.summary}</p> : null}
          </article>
        </li>
      ))}
    </ul>
  );
}
