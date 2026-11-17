import { WorkingAggregateEnvelopeSchema } from "@nextpress/shared/working-aggregate";

export function privateDraftFixture(
  kind: "PAGE" | "POST" = "PAGE",
  version = 0,
) {
  return WorkingAggregateEnvelopeSchema.parse({
    version,
    sourceVersion: 2,
    currentSourceVersion: 2,
    aggregate: {
      contractVersion: 1,
      pageId: "page",
      kind,
      ownerId: "author",
      baseVersion: 1,
      baseFingerprint: "a".repeat(64),
      rawPageDocument: null,
      publicState: { status: "PUBLISHED", publishedAt: "2020-01-01T00:00:00Z" },
      publicationIntent: { action: "PRESERVE" },
      snapshot: {
        schemaVersion: 1,
        fields: {
          title: "Original",
          slug: "original",
          content: "Legacy bytes",
          excerpt: null,
          pageDocument: null,
          layout: "EVENT_PAGE",
          inHeaderMenu: true,
          inFooterMenu: false,
          parentId: null,
          listingKind: null,
          listingTaxonomyId: null,
          eventStart: null,
          eventEnd: null,
          eventLocation: "Historical location",
          registrationUrl: null,
          redirectTo: null,
        },
        relationships: {
          coverId: null,
          tagIds: [],
          categoryIds: [],
          gallery: [],
        },
        extensions: { schemaVersion: 1, values: {} },
      },
    },
  });
}
