import { WorkingAggregateEnvelopeSchema } from "@nextpress/shared/working-aggregate";

import { apiFetch } from "@/lib/api";
import { normalizeSlateValue } from "@/lib/content/editor";

import type {
  WorkingAggregateEnvelope,
  WorkingAggregateSave,
} from "@nextpress/shared/working-aggregate";

import type { PageFormValues, PostFormValues } from "./contracts";

export class PrivateDraftRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

export async function requestPrivateDraft(
  id: string,
  command?: WorkingAggregateSave,
) {
  const { pageId: _pageId, ...body } = command ?? {};
  const response = await apiFetch(
    `/api/private-drafts/${encodeURIComponent(id)}`,
    {
      method: command ? "PUT" : "GET",
      cache: "no-store",
      ...(command
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    },
  );
  const data: unknown = await response.json();

  if (!response.ok) {
    const code =
      typeof data === "object" &&
      data !== null &&
      "code" in data &&
      typeof data.code === "string"
        ? data.code
        : "REQUEST_FAILED";
    throw new PrivateDraftRequestError(response.status, code);
  }

  const draft = WorkingAggregateEnvelopeSchema.parse(data);

  if (
    draft.aggregate.pageId !== id ||
    (command && draft.version !== command.expectedDraftVersion + 1)
  ) {
    throw new Error("Unexpected private draft response identity or version");
  }

  return draft;
}

function commonValues(draft: WorkingAggregateEnvelope) {
  const { fields, relationships } = draft.aggregate.snapshot;

  return {
    id: draft.aggregate.pageId,
    title: fields.title,
    slug: fields.slug,
    content: normalizeSlateValue(fields.content),
    status: draft.aggregate.publicState.status,
    publishedAt: draft.aggregate.publicState.publishedAt,
    tags: relationships.tagIds.map(
      (id) =>
        draft.tagLabels?.find((tag) => tag.id === id) ?? {
          id,
          name: id,
          slug: id,
        },
    ),
  };
}

export function privatePageValues(
  draft: WorkingAggregateEnvelope,
): PageFormValues {
  const { fields } = draft.aggregate.snapshot;

  return {
    ...commonValues(draft),
    type: fields.layout,
    parentId: fields.parentId,
    inHeaderMenu: fields.inHeaderMenu,
    inFooterMenu: fields.inFooterMenu,
    listingKind: fields.listingKind,
    listingTaxonomyId: fields.listingTaxonomyId,
    eventStart: fields.eventStart,
    eventEnd: fields.eventEnd,
    eventLocation: fields.eventLocation,
    registrationUrl: fields.registrationUrl,
    redirectTo: fields.redirectTo,
  };
}

export function privatePostValues(
  draft: WorkingAggregateEnvelope,
): PostFormValues {
  return {
    ...commonValues(draft),
    excerpt: normalizeSlateValue(draft.aggregate.snapshot.fields.excerpt),
    cover: draft.aggregate.snapshot.relationships.coverId
      ? {
          id: draft.aggregate.snapshot.relationships.coverId,
          url: `/api/media/${encodeURIComponent(draft.aggregate.snapshot.relationships.coverId)}`,
        }
      : null,
  };
}
