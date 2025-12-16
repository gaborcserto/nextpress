import type { BaseEditor } from "slate";
import type { ReactEditor } from "slate-react";

export type Align = "left" | "center" | "right" | "justify";

export type CustomText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
};

type WithAlign = { align?: Align };

export type ParagraphElement = WithAlign & {
  type: "paragraph";
  children: CustomText[];
};

export type HeadingElement = WithAlign & {
  type: "heading";
  level: 2 | 3 | 4 | 5 | 6;
  children: CustomText[];
};

export type BlockquoteElement = WithAlign & {
  type: "blockquote";
  children: CustomText[];
};

export type BulletedListElement = WithAlign & {
  type: "bulleted-list";
  children: ListItemElement[];
};

export type NumberedListElement = WithAlign & {
  type: "numbered-list";
  children: ListItemElement[];
};

export type ListItemElement = WithAlign & {
  type: "list-item";
  children: CustomText[];
};

export type CodeBlockElement = WithAlign & {
  type: "code-block";
  children: CustomText[];
};

export type CustomElement =
  | ParagraphElement
  | HeadingElement
  | BlockquoteElement
  | BulletedListElement
  | NumberedListElement
  | ListItemElement
  | CodeBlockElement;

declare module "slate" {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}
