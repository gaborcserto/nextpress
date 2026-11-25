import { serializeRichContent } from "@nextpress/shared/content";
import { describe, expect, it } from "vitest";

import { mapEditorialReferenceEdges } from "./editorial-mapping";

describe("editorial rich-content media references", () => {
  it("tracks embedded images and PDF links from content and excerpt", () => {
    const result = mapEditorialReferenceEdges("revision-1", {
      fields: {
        parentId: null,
        listingTaxonomyId: null,
        pageDocument: null,
        content: serializeRichContent([
          {
            type: "image",
            mediaId: "content-image",
            alt: "",
            children: [{ text: "" }],
          },
          {
            type: "paragraph",
            children: [{ text: "Report", href: "/media/content-document" }],
          },
        ]),
        excerpt: serializeRichContent([
          {
            type: "image",
            mediaId: "excerpt-image",
            alt: "",
            children: [{ text: "" }],
          },
        ]),
      },
      relationships: {
        coverId: null,
        gallery: [],
        tagIds: [],
        categoryIds: [],
      },
    });

    expect(result.edges.media.map(({ mediaId }) => mediaId)).toEqual([
      "content-image",
      "content-document",
      "excerpt-image",
    ]);
    expect(result.issues).toEqual([]);
  });
});
