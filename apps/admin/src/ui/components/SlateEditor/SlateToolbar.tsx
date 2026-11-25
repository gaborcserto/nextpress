"use client";

import { PageDestinationSchema } from "@nextpress/shared/page-document";
import { useEffect, useRef, useState } from "react";
import {
  BsLink45Deg,
  BsX,
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
  BsImage,
} from "react-icons/bs";
import { Editor, Range, Transforms, type RangeRef } from "slate";
import { HistoryEditor } from "slate-history";
import { ReactEditor, useSlate } from "slate-react";

import { MediaDialog } from "@/components/admin/Media/MediaDialog";
import { MediaPicker } from "@/components/admin/Media/MediaPicker";
import { useMediaMessages } from "@/components/admin/Media/messages";
import { useAdminLocale } from "@/lib/i18n/admin-locale";
import {
  AdminButton,
  AdminIconButton,
  AdminToggleButton,
} from "@/ui/primitives/Buttons";

import { insertRichAsset } from "./slate.assets";
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

import type { MediaAsset } from "@nextpress/shared/media";
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
  children,
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

        <div
          className="hidden h-6 w-px shrink-0 bg-base-300 sm:block"
          aria-hidden="true"
        />
        <SlateInsertFileAction />
        <div
          className="hidden h-6 w-px shrink-0 bg-base-300 sm:block"
          aria-hidden="true"
        />

        {children}

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

function SlateInsertFileAction() {
  const editor = useSlate();
  const text = useMediaMessages();
  const selection = useRef<RangeRef | null>(null);
  const [open, setOpen] = useState(false);
  const label = text.insertFile;

  useEffect(
    () => () => {
      selection.current?.unref();
    },
    [],
  );

  function openPicker() {
    const range =
      editor.selection ?? Editor.range(editor, Editor.end(editor, []));
    selection.current?.unref();
    selection.current = Editor.rangeRef(editor, range, { affinity: "inward" });
    setOpen(true);
  }

  function insert(asset: MediaAsset) {
    const range = selection.current?.unref() ?? editor.selection;
    selection.current = null;

    insertRichAsset(editor, range, asset);

    setOpen(false);
    requestAnimationFrame(() => ReactEditor.focus(editor));
  }

  function cancel() {
    const range = selection.current?.unref();
    selection.current = null;
    setOpen(false);

    if (range && Editor.hasPath(editor, range.anchor.path)) {
      Transforms.select(editor, range);
    }

    requestAnimationFrame(() => ReactEditor.focus(editor));
  }

  return (
    <>
      <SlateToolbarButton title={label} onClick={openPicker}>
        <BsImage size={ICON_SIZE} aria-hidden="true" />
      </SlateToolbarButton>
      {open && (
        <MediaPicker
          mode="mixed"
          title={label}
          uploadLabel={text.uploadFilesTab}
          onCancel={cancel}
          onConfirm={(assets) => {
            const asset = assets[0];

            if (asset) {
              insert(asset);
            }
          }}
        />
      )}
    </>
  );
}

export function SlateLinkActions() {
  const editor = useSlate();
  const hu = useAdminLocale() === "hu";
  const selection = useRef<RangeRef | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const href = Editor.marks(editor)?.href;
  const canLink = Boolean(
    editor.selection && (href || Range.isExpanded(editor.selection)),
  );
  const title = href
    ? hu
      ? "Hivatkozás szerkesztése"
      : "Edit link"
    : hu
      ? "Hivatkozás hozzáadása"
      : "Add link";
  const removeLabel = hu ? "Hivatkozás eltávolítása" : "Remove link";

  useEffect(
    () => () => {
      selection.current?.unref();
    },
    [],
  );

  function linkRange() {
    const range = editor.selection;

    if (!range || Range.isExpanded(range) || !href) {
      return range;
    }

    return Editor.range(editor, range.anchor.path);
  }

  function close() {
    const range = selection.current?.unref();
    selection.current = null;
    setUrl(null);

    if (range) {
      if (!editor.selection || !Range.equals(editor.selection, range)) {
        Transforms.select(editor, range);
      }

      requestAnimationFrame(() => ReactEditor.focus(editor));
    }
  }

  function open() {
    const range = linkRange();

    if (!range) {
      return;
    }

    selection.current = Editor.rangeRef(editor, range);
    setInvalid(false);
    setUrl(href ?? "");
  }

  function apply() {
    const result = PageDestinationSchema.safeParse(url?.trim());

    if (!result.success) {
      setInvalid(true);

      return;
    }

    const range = selection.current?.current;

    if (range && HistoryEditor.isHistoryEditor(editor)) {
      Transforms.select(editor, range);
      HistoryEditor.withNewBatch(editor, () => {
        Editor.addMark(editor, "href", result.data);
      });
    }

    close();
  }

  function remove() {
    const range = linkRange();

    if (range && HistoryEditor.isHistoryEditor(editor)) {
      Transforms.select(editor, range);
      HistoryEditor.withNewBatch(editor, () => {
        Editor.removeMark(editor, "href");
      });
      ReactEditor.focus(editor);
    }
  }

  return (
    <div className="flex gap-1">
      <AdminToggleButton
        type="button"
        size="sm"
        variant="ghost"
        title={title}
        aria-label={title}
        disabled={!canLink}
        pressed={Boolean(href)}
        icon={BsLink45Deg}
        onMouseDown={(event) => event.preventDefault()}
        onClick={open}
      />
      <AdminIconButton
        type="button"
        size="sm"
        variant="ghost"
        title={removeLabel}
        icon={BsX}
        aria-label={removeLabel}
        disabled={!href}
        onMouseDown={(event) => event.preventDefault()}
        onClick={remove}
      />
      {url !== null && (
        <MediaDialog title={title} onClose={close}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              apply();
            }}
          >
            <label className="grid gap-1">
              {hu ? "Hivatkozás címe" : "Link address"}
              <input
                className="input w-full"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                aria-invalid={invalid}
                maxLength={2048}
              />
            </label>
            {invalid && (
              <p role="alert">
                {hu
                  ? "Adjon meg relatív útvonalat vagy HTTPS-címet."
                  : "Enter a site-relative path or an HTTPS URL."}
              </p>
            )}
            <AdminButton type="submit" className="mt-3">
              {hu ? "Alkalmazás" : "Apply"}
            </AdminButton>
          </form>
        </MediaDialog>
      )}
    </div>
  );
}
