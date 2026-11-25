import { Editor, Element as SlateElement, Transforms } from "slate";

import type { Align } from "./slate.d";

export type MarkFormat =
  | "bold"
  | "italic"
  | "underline"
  | "strikethrough"
  | "code";

export type BlockFormat =
  | "heading"
  | "blockquote"
  | "bulleted-list"
  | "numbered-list"
  | "code-block";

const LIST_TYPES: BlockFormat[] = ["bulleted-list", "numbered-list"];

export function isMarkActive(editor: Editor, format: MarkFormat): boolean {
  const marks = Editor.marks(editor);

  return Boolean(marks?.[format]);
}

export function toggleMark(editor: Editor, format: MarkFormat): void {
  const active = isMarkActive(editor, format);

  if (active) {
    Editor.removeMark(editor, format);
  } else {
    Editor.addMark(editor, format, true);
  }
}

export function isBlockActive(editor: Editor, type: BlockFormat): boolean {
  const [match] = Editor.nodes(editor, {
    match: (n) => SlateElement.isElement(n) && n.type === type,
  });

  return Boolean(match);
}

export function setAlign(editor: Editor, align: Align): void {
  Transforms.setNodes(
    editor,
    { align },
    { match: (node) => SlateElement.isElement(node) },
  );
}

export function getActiveAlign(editor: Editor): Align | null {
  const [match] = Editor.nodes(editor, {
    match: (node) => SlateElement.isElement(node),
    mode: "lowest",
  });

  if (!match) {
    return null;
  }

  const [node] = match;

  return SlateElement.isElement(node) && "align" in node
    ? (node.align ?? null)
    : null;
}

function unwrapSelectedLists(editor: Editor): void {
  Transforms.unwrapNodes(editor, {
    match: (n) =>
      SlateElement.isElement(n) &&
      (n.type === "bulleted-list" || n.type === "numbered-list"),
    split: true,
  });
}

export function toggleBlock(editor: Editor, type: BlockFormat): void {
  const isActive = isBlockActive(editor, type);
  const isList = LIST_TYPES.includes(type);

  unwrapSelectedLists(editor);

  if (type === "heading") {
    Transforms.setNodes(
      editor,
      isActive ? { type: "paragraph" } : { type: "heading", level: 2 },
      { match: (n) => SlateElement.isElement(n) },
    );

    return;
  }

  if (type === "blockquote") {
    Transforms.setNodes(
      editor,
      isActive ? { type: "paragraph" } : { type: "blockquote" },
      { match: (n) => SlateElement.isElement(n) },
    );

    return;
  }

  if (type === "code-block") {
    Transforms.setNodes(
      editor,
      isActive ? { type: "paragraph" } : { type: "code-block" },
      { match: (n) => SlateElement.isElement(n) },
    );

    return;
  }

  // lists
  Transforms.setNodes(
    editor,
    { type: isActive ? "paragraph" : "list-item" },
    { match: (n) => SlateElement.isElement(n) },
  );

  if (!isActive && isList) {
    if (type === "bulleted-list") {
      Transforms.wrapNodes(
        editor,
        { type: "bulleted-list", children: [] },
        { match: (n) => SlateElement.isElement(n) && n.type === "list-item" },
      );
    } else {
      Transforms.wrapNodes(
        editor,
        { type: "numbered-list", children: [] },
        { match: (n) => SlateElement.isElement(n) && n.type === "list-item" },
      );
    }
  }
}

export function toggleHeading(editor: Editor, level: 2 | 3 | 4 | 5 | 6): void {
  const isActive = isHeadingActive(editor, level);

  Editor.withoutNormalizing(editor, () => {
    unwrapSelectedLists(editor);
    Transforms.setNodes(
      editor,
      isActive ? { type: "paragraph" } : { type: "heading", level },
      { match: (node) => SlateElement.isElement(node) },
    );
  });
}

export function isHeadingActive(
  editor: Editor,
  level: 2 | 3 | 4 | 5 | 6,
): boolean {
  const [match] = Editor.nodes(editor, {
    match: (n) =>
      SlateElement.isElement(n) && n.type === "heading" && n.level === level,
  });

  return Boolean(match);
}
