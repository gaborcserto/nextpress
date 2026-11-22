"use client";

import {
  BsTypeBold,
  BsTypeItalic,
  BsTypeStrikethrough,
  BsTypeUnderline,
  BsCode,
  BsCodeSlash,
  BsQuote,
  BsListUl,
  BsListOl,
  BsTextLeft,
  BsTextCenter,
  BsTextRight,
  BsJustify,
  BsTypeH2,
  BsTypeH3,
  BsTypeH4,
  BsTypeH5,
  BsTypeH6,
} from "react-icons/bs";
import { useSlate } from "slate-react";

import { ICON_SIZE } from "./slate.constants";
import {
  toggleMark,
  isMarkActive,
  toggleBlock,
  isBlockActive,
  setAlign,
  getActiveAlign,
  toggleHeading,
  isHeadingActive,
} from "./slate.utils";

import type { ReactNode } from "react";

import type { ToolbarProps } from "./slate.types";

function SlateToolbarButton({
  active,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      onClick={onClick}
      className={[
        "btn btn-sm btn-square",
        active ? "btn-primary" : "btn-ghost",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function SlateToolbar({
  onToggleCodeViewAction,
  isCodeView,
}: ToolbarProps) {
  const editor = useSlate();
  const activeAlign = getActiveAlign(editor);

  return (
    <div className="border-b border-(--surface-border) bg-(--surface-rail) p-2 rounded-t-(--radius-control)">
      <div className="flex flex-wrap items-center gap-2">
        {/* MARKS */}
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1">
          <SlateToolbarButton
            title="Bold"
            active={isMarkActive(editor, "bold")}
            onClick={() => toggleMark(editor, "bold")}
          >
            <BsTypeBold size={ICON_SIZE} />
          </SlateToolbarButton>

          <SlateToolbarButton
            title="Italic"
            active={isMarkActive(editor, "italic")}
            onClick={() => toggleMark(editor, "italic")}
          >
            <BsTypeItalic size={ICON_SIZE} />
          </SlateToolbarButton>

          <SlateToolbarButton
            title="Underline"
            active={isMarkActive(editor, "underline")}
            onClick={() => toggleMark(editor, "underline")}
          >
            <BsTypeUnderline size={ICON_SIZE} />
          </SlateToolbarButton>

          <SlateToolbarButton
            title="Strikethrough"
            active={isMarkActive(editor, "strikethrough")}
            onClick={() => toggleMark(editor, "strikethrough")}
          >
            <BsTypeStrikethrough size={ICON_SIZE} />
          </SlateToolbarButton>

          <SlateToolbarButton
            title="Inline code"
            active={isMarkActive(editor, "code")}
            onClick={() => toggleMark(editor, "code")}
          >
            <BsCodeSlash size={ICON_SIZE} />
          </SlateToolbarButton>
        </div>

        <div
          className="hidden h-6 w-px shrink-0 bg-base-300 sm:block"
          aria-hidden="true"
        />

        {/* HEADINGS */}
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1">
          <SlateToolbarButton
            title="Heading 2"
            active={isHeadingActive(editor, 2)}
            onClick={() => toggleHeading(editor, 2)}
          >
            <BsTypeH2 size={ICON_SIZE} />
          </SlateToolbarButton>

          <SlateToolbarButton
            title="Heading 3"
            active={isHeadingActive(editor, 3)}
            onClick={() => toggleHeading(editor, 3)}
          >
            <BsTypeH3 size={ICON_SIZE} />
          </SlateToolbarButton>

          <SlateToolbarButton
            title="Heading 4"
            active={isHeadingActive(editor, 4)}
            onClick={() => toggleHeading(editor, 4)}
          >
            <BsTypeH4 size={ICON_SIZE} />
          </SlateToolbarButton>

          <SlateToolbarButton
            title="Heading 5"
            active={isHeadingActive(editor, 5)}
            onClick={() => toggleHeading(editor, 5)}
          >
            <BsTypeH5 size={ICON_SIZE} />
          </SlateToolbarButton>

          <SlateToolbarButton
            title="Heading 6"
            active={isHeadingActive(editor, 6)}
            onClick={() => toggleHeading(editor, 6)}
          >
            <BsTypeH6 size={ICON_SIZE} />
          </SlateToolbarButton>
        </div>

        <div
          className="hidden h-6 w-px shrink-0 bg-base-300 sm:block"
          aria-hidden="true"
        />

        {/* BLOCKS */}
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1">
          <SlateToolbarButton
            title="Quote"
            active={isBlockActive(editor, "blockquote")}
            onClick={() => toggleBlock(editor, "blockquote")}
          >
            <BsQuote size={ICON_SIZE} />
          </SlateToolbarButton>

          <SlateToolbarButton
            title="Bulleted list"
            active={isBlockActive(editor, "bulleted-list")}
            onClick={() => toggleBlock(editor, "bulleted-list")}
          >
            <BsListUl size={ICON_SIZE} />
          </SlateToolbarButton>

          <SlateToolbarButton
            title="Numbered list"
            active={isBlockActive(editor, "numbered-list")}
            onClick={() => toggleBlock(editor, "numbered-list")}
          >
            <BsListOl size={ICON_SIZE} />
          </SlateToolbarButton>
        </div>

        <div
          className="hidden h-6 w-px shrink-0 bg-base-300 sm:block"
          aria-hidden="true"
        />

        {/* ALIGN */}
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1">
          <SlateToolbarButton
            title="Align left"
            active={activeAlign === "left"}
            onClick={() => setAlign(editor, "left")}
          >
            <BsTextLeft size={ICON_SIZE} />
          </SlateToolbarButton>

          <SlateToolbarButton
            title="Align center"
            active={activeAlign === "center"}
            onClick={() => setAlign(editor, "center")}
          >
            <BsTextCenter size={ICON_SIZE} />
          </SlateToolbarButton>

          <SlateToolbarButton
            title="Align right"
            active={activeAlign === "right"}
            onClick={() => setAlign(editor, "right")}
          >
            <BsTextRight size={ICON_SIZE} />
          </SlateToolbarButton>

          <SlateToolbarButton
            title="Justify"
            active={activeAlign === "justify"}
            onClick={() => setAlign(editor, "justify")}
          >
            <BsJustify size={ICON_SIZE} />
          </SlateToolbarButton>
        </div>

        <div className="ml-auto shrink-0" />

        {/* CODE VIEW */}
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1">
          <SlateToolbarButton
            title={isCodeView ? "Back to editor" : "JSON code view"}
            active={isCodeView}
            onClick={onToggleCodeViewAction}
          >
            <BsCode size={ICON_SIZE} />
          </SlateToolbarButton>
        </div>
      </div>
    </div>
  );
}
