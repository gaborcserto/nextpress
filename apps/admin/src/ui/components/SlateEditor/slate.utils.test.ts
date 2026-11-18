import { RichBlocksSchema } from "@nextpress/shared/content";
import { createEditor, Transforms } from "slate";
import { describe, expect, it } from "vitest";

import { getActiveAlign, setAlign, toggleHeading } from "./slate.utils";

describe("Slate block formatting", () => {
  it("converts the selected list item into a valid heading and preserves its neighboring items", () => {
    const editor = createEditor();
    const marked = [{ text: "Second", bold: true }];
    editor.children = [
      {
        type: "numbered-list",
        children: [
          { type: "list-item", children: [{ text: "First" }] },
          { type: "list-item", align: "right", children: marked },
          { type: "list-item", children: [{ text: "Third" }] },
        ],
      },
    ];
    Transforms.select(editor, { path: [0, 1, 0], offset: 1 });

    toggleHeading(editor, 3);

    expect(RichBlocksSchema.parse(editor.children)).toEqual([
      {
        type: "numbered-list",
        children: [{ type: "list-item", children: [{ text: "First" }] }],
      },
      { type: "heading", level: 3, align: "right", children: marked },
      {
        type: "numbered-list",
        children: [{ type: "list-item", children: [{ text: "Third" }] }],
      },
    ]);
  });

  it("aligns the entire block from a caret or a partial text selection", () => {
    const editor = createEditor();
    editor.children = [{ type: "paragraph", children: [{ text: "Example" }] }];
    Transforms.select(editor, { path: [0, 0], offset: 2 });
    setAlign(editor, "center");
    expect(getActiveAlign(editor)).toBe("center");
    Transforms.select(editor, {
      anchor: { path: [0, 0], offset: 2 },
      focus: { path: [0, 0], offset: 4 },
    });

    setAlign(editor, "right");

    expect(editor.children).toEqual([
      { type: "paragraph", align: "right", children: [{ text: "Example" }] },
    ]);
  });
});
