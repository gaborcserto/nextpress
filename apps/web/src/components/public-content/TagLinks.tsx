import Link from "next/link";

import { publicTaxonomyPath } from "@/lib/content/routes";

import styles from "./TagLinks.module.css";
import linkStyles from "./TaxonomyLink.module.css";

import type { PublicTagBatch } from "@/lib/content/public-content.server";

export function TagLinks({ tags }: { tags: PublicTagBatch["tags"] }) {
  const uniqueTags = [...new Map(tags.map((tag) => [tag.slug, tag])).values()];

  return (
    <ul className={styles.tags}>
      {uniqueTags.map(({ slug, name }) => (
        <li key={slug}>
          <Link
            className={linkStyles.link}
            href={publicTaxonomyPath("TAG", slug)}
          >
            {name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
