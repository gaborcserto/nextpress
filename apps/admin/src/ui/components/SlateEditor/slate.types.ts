import type { Descendant } from "slate";

export type SlateValue = Descendant[];

export type SlateEditorProps = {
  value: Descendant[];
  onChangeAction: (value: Descendant[]) => void;
};

export type ToolbarProps = {
  onToggleCodeViewAction: () => void;
  isCodeView: boolean;
};
