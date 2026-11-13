import { LocalizedDate, UiText } from "@/lib/i18n/client";

import styles from "./post-list.module.css";

import type { PublicPostSummary } from "@/lib/content/public-content.server";

type PostMetadataProps = Pick<PublicPostSummary, "publishedAt" | "author">;

export function PostMetadata({ publishedAt, author }: PostMetadataProps) {
  return (
    <>
      <div className={styles.metadata}>
        <LocalizedDate value={publishedAt} />
        {author ? (
          <span>
            <UiText id="posts.by" /> {author.name}
          </span>
        ) : null}
      </div>
    </>
  );
}
