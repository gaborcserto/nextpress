import { describe, expect, it } from "vitest";

import { ContentSlugSchema, readRichContent, richContentText, serializeRichContent, SerializedRichContentSchema, textDocument } from "./content";

describe("rich content contract", () => {
  const blocks = [
    { type: "heading", level: 2, align: "center", children: [{ text: "Title", bold: true }] },
    { type: "bulleted-list", children: [{ type: "list-item", children: [{ text: "Item", italic: true }] }] },
    { type: "code-block", children: [{ text: "<script>literal</script>", code: true }] },
  ];

  it("preserves blocks, lists, marks and alignment across canonical serialization", () => {
    const encoded = serializeRichContent(blocks);
    expect(readRichContent(encoded)).toEqual({ version: 1, blocks });
    expect(SerializedRichContentSchema.parse(encoded)).toBe(encoded);
    expect(richContentText(readRichContent(encoded))).toBe("Title\nItem\n<script>literal</script>");
  });

  it("isolates legacy array and literal text compatibility to reads", () => {
    expect(readRichContent(JSON.stringify(blocks))).toEqual({ version: 1, blocks });
    expect(readRichContent("<p onclick='bad()'>Old HTML</p>")).toEqual(textDocument("<p onclick='bad()'>Old HTML</p>"));
    expect(readRichContent(null)).toEqual(textDocument());
    expect(SerializedRichContentSchema.safeParse(JSON.stringify(blocks)).success).toBe(false);
    expect(SerializedRichContentSchema.safeParse("Old text").success).toBe(false);
  });

  it.each([
    "[", "[]", '{"version":2,"blocks":[]}',
    JSON.stringify({ version: 1, blocks: [{ type: "paragraph", children: [] }] }),
    JSON.stringify({ version: 1, blocks: [{ type: "html", children: [{ text: "unsafe" }] }] }),
    JSON.stringify({ version: 1, blocks: [{ type: "paragraph", onclick: "bad()", children: [{ text: "unsafe" }] }] }),
    JSON.stringify({ version: 1, blocks: [{ type: "heading", level: 1, children: [{ text: "bad" }] }] }),
  ])("rejects malformed or unsupported documents: %s", (value) => {
    expect(SerializedRichContentSchema.safeParse(value).success).toBe(false);
    expect(() => readRichContent(value)).toThrow();
  });

  it("rejects oversized input and nesting outside the editor's supported list structure", () => {
    expect(SerializedRichContentSchema.safeParse("x".repeat(1_000_001)).success).toBe(false);
    expect(() => serializeRichContent([{ type: "paragraph", children: blocks }])).toThrow();
  });
});

describe("content slugs", () => {
  it.each(["", "UPPER", "a/b", "a%2Fb", "a--b", "-a", "a-", "é", "!!!"])("rejects %s", (slug) => {
    expect(ContentSlugSchema.safeParse(slug).success).toBe(false);
  });
  it("accepts canonical single-segment slugs", () => {
    expect(ContentSlugSchema.parse("hello-world-2")).toBe("hello-world-2");
  });
});
