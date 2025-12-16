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

import type { ToolbarProps } from "./slate.types"
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

const ICON_SIZE = 18;

function IconBtn({
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
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={[
        "btn btn-sm",
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
    <div className="border-b border-base-300 bg-base-100 p-2 rounded-t-md">
      <div className="flex flex-wrap items-center gap-2">
        {/* MARKS */}
        <div className="flex items-center gap-1 shrink-0">
          <IconBtn
            title="Bold"
            active={isMarkActive(editor, "bold")}
            onClick={() => toggleMark(editor, "bold")}
          >
            <BsTypeBold size={ICON_SIZE} />
          </IconBtn>

          <IconBtn
            title="Italic"
            active={isMarkActive(editor, "italic")}
            onClick={() => toggleMark(editor, "italic")}
          >
            <BsTypeItalic size={ICON_SIZE} />
          </IconBtn>

          <IconBtn
            title="Underline"
            active={isMarkActive(editor, "underline")}
            onClick={() => toggleMark(editor, "underline")}
          >
            <BsTypeUnderline size={ICON_SIZE} />
          </IconBtn>

          <IconBtn
            title="Strikethrough"
            active={isMarkActive(editor, "strikethrough")}
            onClick={() => toggleMark(editor, "strikethrough")}
          >
            <BsTypeStrikethrough size={ICON_SIZE} />
          </IconBtn>

          <IconBtn
            title="Inline code"
            active={isMarkActive(editor, "code")}
            onClick={() => toggleMark(editor, "code")}
          >
            <BsCodeSlash size={ICON_SIZE} />
          </IconBtn>
        </div>

        <div className="mx-1 h-6 w-px bg-base-300 shrink-0" />

        {/* HEADINGS */}
        <div className="flex items-center gap-1 shrink-0">
          <IconBtn
            title="Heading 2"
            active={isHeadingActive(editor, 2)}
            onClick={() => toggleHeading(editor, 2)}
          >
            <BsTypeH2 size={ICON_SIZE} />
          </IconBtn>

          <IconBtn
            title="Heading 3"
            active={isHeadingActive(editor, 3)}
            onClick={() => toggleHeading(editor, 3)}
          >
            <BsTypeH3 size={ICON_SIZE} />
          </IconBtn>

          <IconBtn
            title="Heading 4"
            active={isHeadingActive(editor, 4)}
            onClick={() => toggleHeading(editor, 4)}
          >
            <BsTypeH4 size={ICON_SIZE} />
          </IconBtn>

          <IconBtn
            title="Heading 5"
            active={isHeadingActive(editor, 5)}
            onClick={() => toggleHeading(editor, 5)}
          >
            <BsTypeH5 size={ICON_SIZE} />
          </IconBtn>

          <IconBtn
            title="Heading 6"
            active={isHeadingActive(editor, 6)}
            onClick={() => toggleHeading(editor, 6)}
          >
            <BsTypeH6 size={ICON_SIZE} />
          </IconBtn>
        </div>

        <div className="mx-1 h-6 w-px bg-base-300 shrink-0" />

        {/* BLOCKS */}
        <div className="flex items-center gap-1 shrink-0">
          <IconBtn
            title="Quote"
            active={isBlockActive(editor, "blockquote")}
            onClick={() => toggleBlock(editor, "blockquote")}
          >
            <BsQuote size={ICON_SIZE} />
          </IconBtn>

          <IconBtn
            title="Bulleted list"
            active={isBlockActive(editor, "bulleted-list")}
            onClick={() => toggleBlock(editor, "bulleted-list")}
          >
            <BsListUl size={ICON_SIZE} />
          </IconBtn>

          <IconBtn
            title="Numbered list"
            active={isBlockActive(editor, "numbered-list")}
            onClick={() => toggleBlock(editor, "numbered-list")}
          >
            <BsListOl size={ICON_SIZE} />
          </IconBtn>
        </div>

        <div className="mx-1 h-6 w-px bg-base-300 shrink-0" />

        {/* ALIGN */}
        <div className="flex items-center gap-1 shrink-0">
          <IconBtn
            title="Align left"
            active={activeAlign === "left"}
            onClick={() => setAlign(editor, "left")}
          >
            <BsTextLeft size={ICON_SIZE} />
          </IconBtn>

          <IconBtn
            title="Align center"
            active={activeAlign === "center"}
            onClick={() => setAlign(editor, "center")}
          >
            <BsTextCenter size={ICON_SIZE} />
          </IconBtn>

          <IconBtn
            title="Align right"
            active={activeAlign === "right"}
            onClick={() => setAlign(editor, "right")}
          >
            <BsTextRight size={ICON_SIZE} />
          </IconBtn>

          <IconBtn
            title="Justify"
            active={activeAlign === "justify"}
            onClick={() => setAlign(editor, "justify")}
          >
            <BsJustify size={ICON_SIZE} />
          </IconBtn>
        </div>

        <div className="ml-auto shrink-0" />

        {/* CODE VIEW */}
        <div className="flex items-center gap-1 shrink-0">
          <IconBtn
            title={isCodeView ? "Back to editor" : "JSON code view"}
            active={isCodeView}
            onClick={onToggleCodeViewAction}
          >
            <BsCode size={ICON_SIZE} />
          </IconBtn>
        </div>
      </div>
    </div>
  );
}
