"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { createEditor, Editor, Element, Node, Transforms, type Descendant } from "slate";
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

export default function SlateEditor({ label = "Content", readOnly = false, value, onChangeAction }: SlateEditorProps) {
  const codeId = useId();
  const editor = useMemo(() => withHistory(withReact(createEditor())), []);
  const [isCodeView, setIsCodeView] = useState(false);
  const [codeDraft, setCodeDraft] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

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

  const toggleCodeViewAction = () => {
    if (!isCodeView) {
      setCodeDraft(JSON.stringify(editor.children, null, 2));
      setCodeError(null);
    }
    setIsCodeView((previous) => !previous);
  };

  return (
    <div className="border border-base-300 rounded-md bg-base-100">
      <Slate editor={editor} initialValue={safeValue} onValueChange={onChangeAction}>
        <SlateToolbar onToggleCodeViewAction={toggleCodeViewAction} isCodeView={isCodeView} />

        {isCodeView ? (
          <div className="p-3">
            <label className="label" htmlFor={codeId}>
              <span className="label-text">Slate JSON</span>
            </label>

            <textarea
              readOnly={readOnly}
              id={codeId}
              className="textarea textarea-bordered w-full font-mono text-sm min-h-55"
              value={codeDraft}
              aria-invalid={Boolean(codeError)}
              aria-describedby={codeError ? `${codeId}-error` : undefined}
              onChange={(e) => {
                setCodeDraft(e.target.value);
                try {
                  const parsed: unknown = JSON.parse(e.target.value);
                  if (!Node.isNodeList(parsed) || !parsed.length || !parsed.every((node) => Element.isElement(node))) {
                    setCodeError("Enter a non-empty array of Slate elements.");
                    return;
                  }
                  Transforms.deselect(editor);
                  Editor.withoutNormalizing(editor, () => {
                    for (let index = editor.children.length - 1; index >= 0; index--) {
                      Transforms.removeNodes(editor, { at: [index] });
                    }
                    Transforms.insertNodes(editor, parsed, { at: [0] });
                  });
                  onChangeAction(parsed);
                  setCodeError(null);
                } catch {
                  setCodeError("Enter valid Slate JSON.");
                }
              }}
            />
            {codeError && <p id={`${codeId}-error`} role="alert" className="mt-2 text-sm text-error">{codeError}</p>}
            <p className="text-xs opacity-70 mt-2">
              Tip: if the JSON is invalid, we don’t update the editor value.
            </p>
          </div>
        ) : (
          <Editable
            readOnly={readOnly}
            aria-label={label}
            placeholder="Write your content..."
            renderElement={renderElement}
            renderLeaf={renderLeaf}
            className="min-h-75 p-4 focus-visible:outline-2 focus-visible:outline-primary prose max-w-none"
          />
        )}
      </Slate>
    </div>
  );
}
