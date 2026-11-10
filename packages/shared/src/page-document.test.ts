import { describe, expect, it } from "vitest";

import { textDocument } from "./content";
import {
  migratePageDocument,
  PAGE_DOCUMENT_CAPABILITIES,
  PageDocumentSchema,
  readPageDocument,
  serializePageDocument,
  supportsPageDocument,
} from "./page-document";

const fixture = {
  version: 1,
  blocks: [
    {
      id: "hero",
      type: "hero",
      version: 1,
      props: { title: "Welcome", description: "Description", mediaId: "cover" },
    },
    {
      id: "columns",
      type: "columns",
      version: 1,
      props: {},
      regions: [
        [
          {
            id: "rich",
            type: "rich-text",
            version: 1,
            props: { document: textDocument("Hello") },
          },
        ],
        [
          {
            id: "image",
            type: "image",
            version: 1,
            props: { mediaId: "cover", alt: "Cover" },
          },
        ],
      ],
    },
    {
      id: "cta",
      type: "call-to-action",
      version: 1,
      props: { label: "Read", href: "/posts" },
    },
    {
      id: "listing",
      type: "content-listing",
      version: 1,
      props: { kind: "POST", limit: 10 },
    },
  ],
};

describe("portable page documents", () => {
  it("round trips all six blocks including the existing rich contract", () => {
    const document = migratePageDocument(fixture);
    expect(readPageDocument(serializePageDocument(document))).toEqual({
      supported: true,
      document,
    });
    expect(supportsPageDocument(document, PAGE_DOCUMENT_CAPABILITIES)).toBe(
      true,
    );
    expect(
      supportsPageDocument(document, { documentVersion: 1, blocks: {} }),
    ).toBe(false);
  });

  it.each([0, 2])(
    "rejects unsupported version %s without guessing a migration",
    (version) => {
      expect(() => migratePageDocument({ ...fixture, version })).toThrow();
    },
  );

  it.each([
    "javascript:alert(1)",
    "//evil.test",
    "/\\evil.test",
    "https://user:password@example.com",
  ])("rejects unsafe link %s", (href) => {
    expect(
      PageDocumentSchema.safeParse({
        version: 1,
        blocks: [
          {
            id: "cta",
            version: 1,
            type: "call-to-action",
            props: { label: "Go", href },
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate IDs and unbounded regions", () => {
    expect(
      PageDocumentSchema.safeParse({
        version: 1,
        blocks: [fixture.blocks[0], fixture.blocks[0]],
      }).success,
    ).toBe(false);
    expect(
      PageDocumentSchema.safeParse({
        version: 1,
        blocks: [
          {
            id: "columns",
            version: 1,
            type: "columns",
            props: {},
            regions: [[], [], [], [], []],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("preserves unknown blocks verbatim for repair while denying rendering and writes", () => {
    const original =
      '{"version":1,"blocks":[{"id":"future","type":"script","version":8,"props":{"code":"alert(1)"}}]}';
    expect(readPageDocument(original)).toEqual({ supported: false, original });
    expect(() => serializePageDocument(JSON.parse(original))).toThrow();
    expect(readPageDocument("{")).toEqual({ supported: false, original: "{" });
  });
});
