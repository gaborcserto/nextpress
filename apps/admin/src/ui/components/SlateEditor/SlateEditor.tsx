"use client";

import { useCallback, useMemo, useState } from "react";
import { createEditor, type Descendant } from "slate";
import { withHistory } from "slate-history";
import {
  Slate,
  Editable,
  withReact,
  type RenderElementProps,
  type RenderLeafProps,
} from "slate-react";

import { EMPTY_SLATE_VALUE } from "./slate.constants";
import type { Align } from "./slate.d";
import type { SlateEditorProps } from "./slate.types";
import SlateToolbar from "./SlateToolbar";
import type { CSSProperties } from "react";

export default function SlateEditor({ value, onChangeAction }: SlateEditorProps) {
  const editor = useMemo(() => withHistory(withReact(createEditor())), []);
  const [isCodeView, setIsCodeView] = useState(false);

  const safeValue: Descendant[] = value?.length ? value : EMPTY_SLATE_VALUE;

  const renderElement = useCallback((props: RenderElementProps) => {
    const { attributes, children, element } = props;

    const style: CSSProperties = {
      textAlign: element.align as Align | undefined,
    };

    switch (element.type) {
      case "heading": {
        const level = element.level;
        if (level === 2) return <h2 {...attributes} style={style}>{children}</h2>;
        if (level === 3) return <h3 {...attributes} style={style}>{children}</h3>;
        if (level === 4) return <h4 {...attributes} style={style}>{children}</h4>;
        if (level === 5) return <h5 {...attributes} style={style}>{children}</h5>;
        return <h6 {...attributes} style={style}>{children}</h6>;
      }
      case "blockquote":
        return (
          <blockquote
            {...attributes}
            style={style}
            className="border-l-4 border-base-300 pl-4 italic opacity-90"
          >
            {children}
          </blockquote>
        );
      case "bulleted-list":
        return <ul {...attributes} className="list-disc pl-6">{children}</ul>;
      case "numbered-list":
        return <ol {...attributes} className="list-decimal pl-6">{children}</ol>;
      case "list-item":
        return <li {...attributes}>{children}</li>;
      case "code-block":
        return (
          <pre {...attributes} className="rounded-md border border-base-300 bg-base-200 p-3 overflow-auto">
            <code>{children}</code>
          </pre>
        );
      default:
        return <p {...attributes}>{children}</p>;
    }
  }, []);

  const renderLeaf = useCallback((props: RenderLeafProps) => {
    const { attributes, children, leaf } = props;

    let out = children;
    if (leaf.bold) out = <strong>{out}</strong>;
    if (leaf.italic) out = <em>{out}</em>;
    if (leaf.underline) out = <u>{out}</u>;
    if (leaf.strikethrough) out = <s>{out}</s>;
    if (leaf.code) out = <code className="px-1 rounded bg-base-200 border border-base-300">{out}</code>;

    return <span {...attributes}>{out}</span>;
  }, []);

  const toggleCodeViewAction = () => setIsCodeView((p) => !p);

  return (
    <div className="border border-base-300 rounded-md bg-base-100">
      <Slate editor={editor} initialValue={safeValue} onValueChange={onChangeAction}>
        <SlateToolbar onToggleCodeViewAction={toggleCodeViewAction} isCodeView={isCodeView} />

        {isCodeView ? (
          <div className="p-3">
            <label className="label">
              <span className="label-text">Slate JSON</span>
            </label>

            <textarea
              className="textarea textarea-bordered w-full font-mono text-sm min-h-[220px]"
              value={JSON.stringify(safeValue, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value) as Descendant[];
                  onChangeAction(parsed);
                } catch {
                  // invalid JSON: ignore (keeps typing), you can add an error UI later
                }
              }}
            />
            <p className="text-xs opacity-70 mt-2">
              Tip: if the JSON is invalid, we don’t update the editor value.
            </p>
          </div>
        ) : (
          <Editable
            placeholder="Write your content..."
            renderElement={renderElement}
            renderLeaf={renderLeaf}
            className="min-h-[300px] p-4 outline-none prose max-w-none"
          />
        )}
      </Slate>
    </div>
  );
}
