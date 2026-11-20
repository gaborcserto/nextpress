import type { ContentListSchema } from "@nextpress/shared/api-contracts";
import type { z } from "zod";

type ContentListRecord = z.infer<typeof ContentListSchema>["items"][number];
export type PublicationState = ContentListRecord["publicationState"];
export type PublicationFields = {
  status: ContentListRecord["status"];
  publishedAt?: string | null;
};

export const publicationLabels = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  SCHEDULED: "Scheduled",
  MISSING_DATE: "Publication date missing",
} satisfies Record<PublicationState, string>;

export function savedPublicationState({
  status,
  publishedAt,
}: PublicationFields): PublicationState {
  if (status === "DRAFT") {
    return "DRAFT";
  }

  if (!publishedAt) {
    return "MISSING_DATE";
  }

  return Date.parse(publishedAt) > Date.now() ? "SCHEDULED" : "PUBLISHED";
}
