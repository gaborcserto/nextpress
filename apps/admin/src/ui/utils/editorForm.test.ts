import { describe, expect, it } from "vitest";

import { buildInitialForm, getEntityId, normalizeSlateValue, slateToString } from "./editorForm";

describe("editor form helpers", () => {
  it("generates a slug only when the initial slug is empty", () => {
    const initial = { title: "Hello World", slug: "", status: "DRAFT" };
    expect(buildInitialForm(initial)).toEqual({
      ...initial,
      slug: "hello-world",
    });
    expect(buildInitialForm({ ...initial, slug: "custom" }).slug).toBe("custom");
  });

  it("extracts only non-empty string entity ids", () => {
    expect(getEntityId({ id: "page-1" })).toBe("page-1");
    expect(getEntityId({ id: "  " })).toBeUndefined();
    expect(getEntityId({ id: 1 })).toBeUndefined();
    expect(getEntityId(null)).toBeUndefined();
  });

  it("normalizes empty, string, and malformed Slate values", () => {
    expect(normalizeSlateValue(null)).toEqual([{ type: "paragraph", children: [{ text: "" }] }]);
    expect(normalizeSlateValue("  Hello  ")).toEqual([
      { type: "paragraph", children: [{ text: "Hello" }] },
    ]);
    expect(normalizeSlateValue([{ type: "paragraph", children: [] }])).toEqual([
      { type: "paragraph", children: [{ text: "" }] },
    ]);
    expect(normalizeSlateValue([{ text: "loose text" }])).toEqual([
      { type: "paragraph", children: [{ text: "loose text" }] },
    ]);
  });

  it("serializes normalized content", () => {
    expect(slateToString("Hello")).toBe(
      JSON.stringify([{ type: "paragraph", children: [{ text: "Hello" }] }])
    );
  });
});
