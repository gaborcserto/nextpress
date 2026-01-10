import type { Descendant } from "slate";

export const EMPTY_SLATE_VALUE: Descendant[] = [
  {
    type: "paragraph",
    children: [{ text: "" }],
  },
];

export const ICON_SIZE = 18;
