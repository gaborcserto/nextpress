import { describe, expect, it } from "vitest";

import {
  buildInitialForm,
  getEntityId,
  normalizeSlateValue,
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

  it("normalizes strings and malformed Slate values", () => {
    expect(normalizeSlateValue(null)).toEqual([
      { type: "paragraph", children: [{ text: "" }] },
    ]);
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

  it("serializes normalized Slate values", () => {
    expect(slateToString("Hello")).toBe(
      JSON.stringify([{ type: "paragraph", children: [{ text: "Hello" }] }]),
    );
  });
});
