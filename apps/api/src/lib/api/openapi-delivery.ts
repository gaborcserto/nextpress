import {
  PublicPaginationSchema,
  PublicSearchQuerySchema,
  PublicSearchResultSchema,
  PublicTaxonomyParamsSchema,
} from "@nextpress/shared/api-contracts";

import { operation, parameter, ref, schema } from "./openapi-builders";

import type { OpenAPIV3 } from "openapi-types";

const string = { type: "string" } as const;
export const deliveryPaths: OpenAPIV3.PathsObject = {};

for (const [path, result, operationId] of [
  ["public/posts", "PublicPostBatch", "publicPosts"],
  ["public/posts/{slug}", "PublicContent", "publicPost"],
  ["public/pages/{slug}", "PublicContent", "publicPage"],
  ["public/home", "PublicContent", "publicHome"],
  ["public/menus", "PublicMenus", "publicMenus"],
  ["public/navigation", "PublicNavigation", "publicNavigation"],
  ["public/settings", "PublicSiteSettings", "publicSettings"],
  ["discovery/session", "SessionDiscovery", "sessionDiscovery"],
  ["discovery/providers", "ProviderDiscovery", "providerDiscovery"],
]) {
  const read = operation(
    operationId,
    "Delivery and discovery",
    operationId,
    ref(result),
    path.includes("{slug}") || path === "public/home"
      ? [404, 500]
      : path === "public/posts"
        ? [400, 500]
        : [500],
    path.startsWith("public/")
      ? "Cookie-independent delivery. Only PUBLISHED content with explicit publication time at or before the request is visible. Uncached."
      : "Same-origin discovery; session identity is validated by Better Auth and roles read live. No tokens or credentials returned.",
    path === "discovery/session" ? "optional" : "public",
  );

  if (path.includes("{slug}")) {
    read.parameters = [
      parameter("slug", "path", string, "Canonical content slug."),
    ];
  }

  if (path === "public/pages/{slug}") {
    read.parameters?.push(
      parameter(
        "path",
        "query",
        string,
        "Require the currently published canonical Page path.",
      ),
    );
  }

  if (path === "public/posts") {
    read.parameters = Object.entries(PublicPaginationSchema.shape).map(
      ([key, value]) =>
        parameter(
          key,
          "query",
          schema(value),
          "Single bounded decimal integer; duplicates rejected.",
        ),
    );
  }

  deliveryPaths[`/api/${path}`] = { get: read };
}

const publishedTags = operation(
  "publicTags",
  "Delivery and discovery",
  "Tags assigned to publicly published posts",
  ref("PublicTagBatch"),
  [400, 500],
  "Cookie-independent, uncached delivery. Only TAG definitions assigned to POST/PUBLISHED records with a non-null publication time at or before now are listed. Unique tags ordered by slug, bounded limit-plus-one pagination. Duplicate, unknown and malformed query parameters are rejected. No draft-only, scheduled-only, unassigned or page-only tags.",
  "public",
);
publishedTags.parameters = Object.entries(PublicPaginationSchema.shape).map(
  ([key, value]) =>
    parameter(key, "query", schema(value), "Single bounded decimal integer."),
);
deliveryPaths["/api/public/tags"] = { get: publishedTags };

const taxonomyArchive = operation(
  "publicTaxonomyPosts",
  "Delivery and discovery",
  "Published posts assigned to a category or tag",
  ref("PublicTaxonomyBatch"),
  [400, 404, 500],
  "Cookie-independent, uncached delivery. Taxonomy definitions have no privacy state. Only POST/PUBLISHED records with non-null publication time at or before now are included. Missing or invalid type/slug returns 404; existing empty definitions return an empty batch. Bounded newest-first pagination; duplicate or unknown query parameters rejected.",
  "public",
);
taxonomyArchive.parameters = [
  ...Object.entries(PublicTaxonomyParamsSchema.shape).map(([key, value]) =>
    parameter(
      key,
      "path",
      schema(value),
      "Taxonomy type (CATEGORY or TAG) and canonical slug.",
    ),
  ),
  ...Object.entries(PublicPaginationSchema.shape).map(([key, value]) =>
    parameter(key, "query", schema(value), "Single bounded decimal integer."),
  ),
];
deliveryPaths["/api/public/taxonomies/{type}/{slug}"] = {
  get: taxonomyArchive,
};

const search = operation(
  "publicSearch",
  "Delivery and discovery",
  "Search published posts and pages",
  schema(PublicSearchResultSchema),
  [400, 500],
  "Uncached public search. Published-at or before now only. Ten results per page, up to page 100; 200-character query. Title matches rank first; newest and slug break ties. Taxonomies come only from published posts. Duplicate and unknown parameters rejected.",
  "public",
);
search.parameters = Object.entries(PublicSearchQuerySchema.shape).map(
  ([key, value]) =>
    parameter(key, "query", schema(value), "Validated search parameter."),
);
deliveryPaths["/api/public/search"] = { get: search };
