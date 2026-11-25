import type { ReactNode } from "react";
import type { Descendant } from "slate";

export type SlateValue = Descendant[];

export type SlateEditorProps = {
  label?: string;
  readOnly?: boolean;
  compact?: boolean;
  value: Descendant[];
  onChangeAction: (value: Descendant[]) => void;
};

export type ToolbarProps = {
  onToggleCodeViewAction: () => void;
  isCodeView: boolean;
  children?: ReactNode;
};
