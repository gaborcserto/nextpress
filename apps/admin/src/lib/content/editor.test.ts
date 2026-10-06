import { describe, expect, it } from "vitest";

import {
  buildInitialForm,
  getEntityId,
  normalizeSlateValue,
  publicationDateToLocal,
  slateToString,
} from "./editor";

describe("editor content helpers", () => {
  it("generates a missing slug without replacing an existing slug", () => {
    expect(buildInitialForm({ title: "Hello World", slug: "" }).slug).toBe(
      "hello-world",
    );
    expect(buildInitialForm({ title: "Hello World", slug: "custom" }).slug).toBe(
      "custom",
    );
  });

  it("extracts only non-empty string entity IDs", () => {
    expect(getEntityId({ id: "page-1" })).toBe("page-1");
    expect(getEntityId({ id: "" })).toBeUndefined();
    expect(getEntityId(null)).toBeUndefined();
  });

  it("reads legacy strings as literal text and rejects malformed Slate", () => {
    expect(normalizeSlateValue(null)).toEqual([{ type: "paragraph", children: [{ text: "" }] }]);
    expect(normalizeSlateValue("  Hello  ")).toEqual([{ type: "paragraph", children: [{ text: "  Hello  " }] }]);
    expect(() => normalizeSlateValue([{ type: "paragraph", children: [] }])).toThrow();
  });

  it("serializes and reopens formatted content without JSON appearing as text", () => {
    const blocks = [{ type: "paragraph" as const, children: [{ text: "Hello", bold: true }] }];
    expect(normalizeSlateValue(slateToString(blocks))).toEqual(blocks);
    expect(JSON.parse(slateToString(blocks))).toEqual({ version: 1, blocks });
  });
  it("preserves the publication instant through the local date input including seconds", () => {
    const instant = "2024-06-01T12:34:56.789Z";
    const local = publicationDateToLocal(instant);
    expect(local).not.toBeNull();
    expect(new Date(local ?? "").toISOString()).toBe(instant);
    expect(publicationDateToLocal(null)).toBeNull();
  });
});
