import type { PostProps } from "../../types";

const MORE_ARTICLES_LIMIT = 4;

export function selectMoreArticles(
  postSlug: string,
  additionalPosts: NonNullable<PostProps["additionalPosts"]>,
) {
  return [
    ...new Map(
      additionalPosts
        .filter(({ slug }) => slug !== postSlug)
        .map((article) => [article.slug, article]),
    ).values(),
  ]
    .sort(
      (left, right) =>
        Date.parse(right.publishedAt) - Date.parse(left.publishedAt) ||
        left.slug.localeCompare(right.slug, "en"),
    )
    .slice(0, MORE_ARTICLES_LIMIT);
}
