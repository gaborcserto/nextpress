import type { RichBlock, RichText } from "@nextpress/shared/content";
import type { BaseEditor } from "slate";
import type { ReactEditor } from "slate-react";

export type Align = NonNullable<RichBlock["align"]>;
export type CustomText = RichText;
export type CustomElement = RichBlock;

declare module "slate" {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}
