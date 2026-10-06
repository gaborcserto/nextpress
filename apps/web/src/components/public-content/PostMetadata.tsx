import styles from "./post-list.module.css";

type PostMetadataProps = {
  publishedAt: string;
  author?: { name: string } | null;
  taxonomies?: { type: "TAG" | "CATEGORY"; name: string }[];
};

export function PostMetadata({ publishedAt, author, taxonomies = [] }: PostMetadataProps) {
  const categories = taxonomies.filter(({ type }) => type === "CATEGORY");
  return (
    <div className={styles.metadata}>
      <time dateTime={publishedAt}>{new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(publishedAt))}</time>
      {author ? <span>By {author.name}</span> : null}
      {categories.length > 0 ? <span>{categories.map(({ name }) => name).join(", ")}</span> : null}
    </div>
  );
}
