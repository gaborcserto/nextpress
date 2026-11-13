import styles from "./post-list.module.css";

import type { PublicPostSummary } from "@/lib/content/public-content.server";

type PostMetadataProps = Pick<PublicPostSummary, "publishedAt" | "author">;

export function PostMetadata({ publishedAt, author }: PostMetadataProps) {
  return (
    <>
      <div className={styles.metadata}>
        <time dateTime={publishedAt}>
          {new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(
            new Date(publishedAt),
          )}
        </time>
        {author ? <span>By {author.name}</span> : null}
      </div>
    </>
  );
}
