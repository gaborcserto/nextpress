import "server-only";

import { PublicContentIndexSchema } from "@nextpress/shared/api-contracts";

import { fetchPublic } from "./public-api.server";

import type { PageBlock } from "@nextpress/shared/page-document";

export function getDocumentListing({
  kind,
  limit,
  taxonomyId,
}: Extract<PageBlock, { type: "content-listing" }>["props"]) {
  const params = new URLSearchParams({ kind, limit: String(limit) });

  if (taxonomyId) {
    params.set("taxonomyId", taxonomyId);
  }

  return fetchPublic(`content?${params}`, PublicContentIndexSchema);
}
