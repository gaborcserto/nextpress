import { describe, expect, it } from "vitest";

import { EMPTY_RICH_CONTENT } from "./content";
import { RevisionActionSchema, RevisionInputSchema } from "./revisions";

const snapshot = {
  expectedVersion: 0,
  title: "Working title",
  slug: "working-title",
  content: EMPTY_RICH_CONTENT,
  excerpt: EMPTY_RICH_CONTENT,
  layout: "STANDARD",
  pageDocument: { version: 1, blocks: [] },
};
describe("revision boundaries", () => {
  it("accepts an independent snapshot without publication fields", () => {
    expect(RevisionInputSchema.parse(snapshot)).toMatchObject({
      title: "Working title",
      expectedVersion: 0,
    });
    expect(
      RevisionInputSchema.safeParse({ ...snapshot, status: "PUBLISHED" })
        .success,
    ).toBe(false);
  });
  it.each([-1, 0.5, 2_147_483_647])(
    "rejects invalid expected version %s",
    (expectedVersion) => {
      expect(
        RevisionInputSchema.safeParse({ ...snapshot, expectedVersion }).success,
      ).toBe(false);
    },
  );
  it("requires exact revision identity and an explicit transition", () => {
    expect(
      RevisionActionSchema.safeParse({ expectedVersion: 0, action: "publish" })
        .success,
    ).toBe(false);
    expect(
      RevisionActionSchema.safeParse({
        expectedVersion: 0,
        revisionId: "revision",
        action: "publish-anything",
      }).success,
    ).toBe(false);
  });
  it("rejects executable rich input and overlarge composition", () => {
    expect(
      RevisionInputSchema.safeParse({
        ...snapshot,
        content: "<script>bad()</script>",
      }).success,
    ).toBe(false);
    expect(
      RevisionInputSchema.safeParse({
        ...snapshot,
        pageDocument: {
          version: 1,
          blocks: [
            {
              id: "rich",
              version: 1,
              type: "rich-text",
              props: {
                document: {
                  version: 1,
                  blocks: [
                    {
                      type: "paragraph",
                      children: [{ text: "x".repeat(1_000_001) }],
                    },
                  ],
                },
              },
            },
          ],
        },
      }).success,
    ).toBe(false);
  });
});
