import { PublicTaxonomyParamsSchema } from "@nextpress/shared/api-contracts";

import { publicTaxonomyPath } from "@/lib/content/routes";
import { LocaleLink as Link, UiText } from "@/lib/i18n/client";

import styles from "./PostTaxonomies.module.css";
import linkStyles from "./TaxonomyLink.module.css";

import type { PublicPostSummary } from "@/lib/content/public-content.server";

export function PostTaxonomies({
  taxonomies,
}: {
  taxonomies: PublicPostSummary["taxonomies"];
}) {
  const assignments = [
    ...new Map(
      taxonomies
        .filter(
          (item) =>
            item.name.trim() &&
            PublicTaxonomyParamsSchema.safeParse({
              type: item.type,
              slug: item.slug,
            }).success,
        )
        .map((item) => [`${item.type}:${item.slug}`, item]),
    ).values(),
  ].sort((left, right) => left.slug.localeCompare(right.slug, "en"));

  if (assignments.length === 0) {
    return null;
  }

  return (
    <dl className={styles.taxonomies}>
      {(["CATEGORY", "TAG"] as const).map((type) => {
        const items = assignments.filter((item) => item.type === type);

        if (items.length === 0) {
          return null;
        }

        return (
          <div key={type}>
            <dt>
              <UiText
                id={
                  type === "CATEGORY"
                    ? "taxonomy.categoriesLabel"
                    : "taxonomy.tagsLabel"
                }
              />
            </dt>
            <dd>
              <ul>
                {items.map(({ slug, name }) => (
                  <li key={slug}>
                    <Link
                      className={linkStyles.link}
                      href={publicTaxonomyPath(type, slug)}
                    >
                      {name}
                    </Link>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
