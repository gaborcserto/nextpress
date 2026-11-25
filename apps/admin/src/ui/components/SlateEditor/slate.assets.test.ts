import { MediaAssetSchema } from "@nextpress/shared/media";
import { createEditor, Editor } from "slate";
import { withHistory, HistoryEditor } from "slate-history";
import { describe, expect, it } from "vitest";

import { insertRichAsset } from "./slate.assets";

const image = MediaAssetSchema.parse({
  id: "image-1",
  url: "/media/image-1",
  alt: "A view",
  mime: "image/png",
  width: 640,
  height: 480,
  filename: "view.png",
  originalMime: "image/png",
  size: 128,
  caption: null,
  description: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: null,
});

const pdf = MediaAssetSchema.parse({
  ...image,
  id: "document-1",
  mime: "application/pdf",
  filename: "report.pdf",
  caption: "Annual report",
});

function editorAt(offset: number) {
  const editor = withHistory(createEditor());
  editor.children = [
    { type: "paragraph", children: [{ text: "hello world" }] },
  ];
  editor.selection = Editor.range(editor, {
    path: [0, 0],
    offset,
  });

  return editor;
}

describe("rich asset insertion", () => {
  it("inserts an image at the saved cursor and supports undo and redo", () => {
    const editor = editorAt(5);
    const savedSelection = editor.selection;

    expect(insertRichAsset(editor, savedSelection, image)).toBe(true);
    expect(editor.children).toEqual([
      { type: "paragraph", children: [{ text: "hello" }] },
      {
        type: "image",
        mediaId: image.id,
        alt: image.alt,
        width: image.width,
        height: image.height,
        children: [{ text: "" }],
      },
      { type: "paragraph", children: [{ text: " world" }] },
    ]);

    HistoryEditor.undo(editor);
    expect(editor.children).toEqual([
      { type: "paragraph", children: [{ text: "hello world" }] },
    ]);
    HistoryEditor.redo(editor);
    expect(editor.children[1]).toMatchObject({
      type: "image",
      mediaId: image.id,
    });
  });

  it("inserts a PDF as a linked paragraph at the saved cursor", () => {
    const editor = editorAt(5);

    expect(insertRichAsset(editor, editor.selection, pdf)).toBe(true);
    expect(editor.children[1]).toEqual({
      type: "paragraph",
      children: [{ text: "Annual report", href: "/media/document-1" }],
    });
  });
});
