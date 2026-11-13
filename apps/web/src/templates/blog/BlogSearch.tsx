import listStyles from "@/components/public-content/post-list.module.css";
import { PostTaxonomies } from "@/components/public-content/PostTaxonomies";
import { Container } from "@/components/public-ui/Container";
import { publicContentPath } from "@/lib/content/routes";
import { searchHref } from "@/lib/content/search";
import { LocaleLink as Link, LocalizedDate } from "@/lib/i18n/client";
import { getMessages } from "@/lib/i18n/messages";
import { localizedHref } from "@/lib/i18n/routing";
import { getLocale } from "@/lib/i18n/server";

import archiveStyles from "./BlogArchive.module.css";
import headingStyles from "./BlogHeading.module.css";
import styles from "./BlogSearch.module.css";

import type { SearchProps } from "../types";

export async function BlogSearch({ query, data }: SearchProps) {
  const locale = await getLocale();
  const text = getMessages(locale);
  const search = text.search;
  const pages = Math.min(100, Math.ceil(data.total / 10));

  return (
    <Container className={archiveStyles.archive}>
      <h1 className={`${headingStyles.heading} ${archiveStyles.pageHeading}`}>
        {search.results}
      </h1>
      <form
        action={localizedHref("/search", locale)}
        className={styles.filters}
        role="search"
        aria-label={search.filters}
      >
        <label className={styles.query}>
          {search.label}
          <input
            name="q"
            type="search"
            defaultValue={query.q}
            placeholder={search.placeholder}
            maxLength={200}
          />
        </label>
        <label>
          {search.type}
          <select name="type" defaultValue={query.type}>
            {(["all", "posts", "pages"] as const).map((type) => (
              <option key={type} value={type}>
                {search[type]}
              </option>
            ))}
          </select>
        </label>
        {query.type !== "pages" &&
          (["CATEGORY", "TAG"] as const).map((type) => (
            <label key={type}>
              {type === "CATEGORY" ? search.category : search.tag}
              <select
                name={type === "CATEGORY" ? "category" : "tag"}
                defaultValue={type === "CATEGORY" ? query.category : query.tag}
              >
                <option value="">{search.all}</option>
                {data.taxonomies
                  .filter((item) => item.type === type)
                  .map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
          ))}
        <label>
          {search.sort}
          <select name="sort" defaultValue={query.sort}>
            <option value="relevance">{search.relevance}</option>
            <option value="newest">{search.newest}</option>
          </select>
        </label>
        <button type="submit">{search.apply}</button>
        <Link href="/search">{search.clear}</Link>
      </form>
      <p>
        {query.q
          ? (data.total === 1 ? search.countOne : search.count).replace(
              "{count}",
              String(data.total),
            )
          : search.empty}
      </p>
      {query.q && data.results.length === 0 && <p>{search.noResults}</p>}
      <ol className={`${listStyles.compact} ${styles.results}`}>
        {data.results.map((item) => (
          <li key={item.slug}>
            <h2 className={listStyles.title}>
              <Link href={publicContentPath(item.type, item.slug)}>
                {item.title}
              </Link>
            </h2>
            <p>
              {item.type === "POST" ? search.posts : search.pages} ·{" "}
              <LocalizedDate value={item.publishedAt} />
            </p>
            {item.summary && (
              <p className={`${listStyles.summary} ${styles.summary}`}>
                {item.summary}
              </p>
            )}
            {item.type === "POST" && (
              <PostTaxonomies taxonomies={item.taxonomies} />
            )}
          </li>
        ))}
      </ol>
      {query.q && (query.page > 1 || pages > 1) && (
        <nav
          className={listStyles.archiveNavigation}
          aria-label={search.pagination}
        >
          {query.page > 1 ? (
            <Link href={searchHref(query, query.page - 1)}>
              {text.pagination.previous}
            </Link>
          ) : (
            <span />
          )}
          <p>
            {text.pagination.page} <span aria-current="page">{query.page}</span>
          </p>
          {query.page < pages ? (
            <Link href={searchHref(query, query.page + 1)}>
              {text.pagination.next}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </Container>
  );
}
