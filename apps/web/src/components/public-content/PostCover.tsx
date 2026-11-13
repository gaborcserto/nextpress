import Image from "next/image";

import styles from "./post-list.module.css";

import type { PublicPostSummary } from "@/lib/content/public-content.server";

type PostCoverProps = {
  cover: PublicPostSummary["cover"];
  title: string;
  card?: boolean;
  eager?: boolean;
};

/** Unknown dimensions cannot reserve the source aspect ratio reliably. */
export function PostCover({
  cover,
  title,
  card = false,
  eager = false,
}: PostCoverProps) {
  if (
    !cover ||
    !cover.width ||
    !cover.height ||
    cover.width < 1 ||
    cover.height < 1
  ) {
    return null;
  }

  return (
    <div className={card ? styles.cardMedia : styles.articleMedia}>
      <Image
        src={cover.url}
        alt={cover.alt || `Cover for ${title}`}
        width={cover.width}
        height={cover.height}
        sizes={
          card
            ? "(max-width: 47.99rem) 100vw, (max-width: 72rem) 50vw, 720px"
            : "(max-width: 48rem) 100vw, 768px"
        }
        loading={eager || !card ? "eager" : "lazy"}
        unoptimized
      />
    </div>
  );
}
