"use client";

import {
  PageDocumentSchema,
  type PageBlock,
  type PageDocument,
} from "@nextpress/shared/page-document";
import { useState } from "react";

import { Button } from "@/ui/primitives";

import { DocumentPicker, MediaPicker } from "./MediaPicker";
import { useMediaMessages } from "./messages";

import type { MediaAsset } from "@nextpress/shared/media";

type AssetBlock = Extract<PageBlock, { type: "hero" | "image" | "document" }>;

export function DocumentImageField({
  value,
  onChange,
  disabled,
}: {
  value?: PageDocument | null;
  onChange: (value: PageDocument) => void;
  disabled?: boolean;
}) {
  const text = useMediaMessages();
  const documents = useMediaMessages(true);
  const [target, setTarget] = useState<
    AssetBlock | "new-image" | "new-document" | null
  >(null);
  const [error, setError] = useState(false);
  const blocks = value?.blocks ?? [];
  const assets = blocks
    .flatMap((block) =>
      block.type === "columns" ? block.regions.flat() : [block],
    )
    .filter(
      (block) =>
        block.type === "image" ||
        block.type === "hero" ||
        block.type === "document",
    );

  function update(next: PageBlock[]) {
    const result = PageDocumentSchema.safeParse({ version: 1, blocks: next });
    setError(!result.success);

    if (result.success) {
      onChange(result.data);
    }
  }

  function changeBlock(id: string, replacement?: AssetBlock) {
    update(
      blocks.flatMap<PageBlock>((block) => {
        if (block.id === id) {
          return replacement ? [replacement] : [];
        }

        if (block.type === "columns") {
          return [
            {
              ...block,
              regions: block.regions.map((region) =>
                region.flatMap((child) =>
                  child.id === id
                    ? replacement
                      ? [replacement]
                      : []
                    : [child],
                ),
              ),
            },
          ];
        }

        return [block];
      }),
    );
  }

  function choose([asset]: MediaAsset[]) {
    if (!asset || !target) {
      return;
    }

    if (
      target === "new-document" ||
      (typeof target !== "string" && target.type === "document")
    ) {
      const block: Extract<AssetBlock, { type: "document" }> = {
        id: target === "new-document" ? crypto.randomUUID() : target.id,
        type: "document",
        version: 1,
        props: {
          documentId: asset.id,
          label: asset.caption || asset.filename || "PDF",
          description: asset.description ?? "",
        },
      };

      if (target === "new-document") {
        update([...blocks, block]);
      } else {
        changeBlock(target.id, {
          ...block,
          props: { ...target.props, documentId: asset.id },
        });
      }
    } else if (target === "new-image") {
      update([
        ...blocks,
        {
          id: crypto.randomUUID(),
          type: "image",
          version: 1,
          props: { mediaId: asset.id, alt: asset.alt ?? "" },
        },
      ]);
    } else if (target.type === "hero") {
      changeBlock(target.id, {
        ...target,
        props: { ...target.props, mediaId: asset.id },
      });
    } else {
      changeBlock(target.id, {
        ...target,
        props: { mediaId: asset.id, alt: asset.alt ?? "" },
      });
    }

    setTarget(null);
  }

  function remove(block: AssetBlock) {
    if (block.type !== "hero") {
      changeBlock(block.id);
    } else {
      changeBlock(block.id, {
        ...block,
        props: {
          title: block.props.title,
          description: block.props.description,
        },
      });
    }
  }

  const Picker =
    target === "new-document" ||
    (target && typeof target !== "string" && target.type === "document")
      ? DocumentPicker
      : MediaPicker;

  return (
    <fieldset className="mt-4 min-w-0 space-y-2">
      <legend className="font-semibold">{text.contentAssets}</legend>
      {assets.length > 0 && (
        <ul className="grid gap-2">
          {assets.map((block) => (
            <li key={block.id} className="grid gap-2">
              <span className="wrap-anywhere">
                {block.type === "hero"
                  ? block.props.title
                  : block.type === "document"
                    ? "PDF"
                    : block.props.mediaId}
              </span>
              {block.type === "image" && (
                <label className="grid gap-1">
                  {text.alt}
                  <input
                    className="input w-full"
                    value={block.props.alt}
                    maxLength={500}
                    disabled={disabled}
                    onChange={(event) =>
                      changeBlock(block.id, {
                        ...block,
                        props: {
                          ...block.props,
                          alt: event.currentTarget.value,
                        },
                      })
                    }
                  />
                </label>
              )}
              {block.type === "document" && (
                <>
                  <label className="grid gap-1">
                    {documents.caption}
                    <input
                      className="input w-full"
                      value={block.props.label}
                      maxLength={500}
                      disabled={disabled}
                      onChange={(event) =>
                        changeBlock(block.id, {
                          ...block,
                          props: {
                            ...block.props,
                            label: event.currentTarget.value,
                          },
                        })
                      }
                    />
                  </label>
                  <label className="grid gap-1">
                    {documents.description}
                    <textarea
                      className="textarea w-full"
                      value={block.props.description}
                      maxLength={2000}
                      disabled={disabled}
                      onChange={(event) =>
                        changeBlock(block.id, {
                          ...block,
                          props: {
                            ...block.props,
                            description: event.currentTarget.value,
                          },
                        })
                      }
                    />
                  </label>
                </>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => setTarget(block)}
                >
                  {block.type === "document" ? documents.choose : text.choose}
                </Button>
                {(block.type === "document" || block.props.mediaId) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    onClick={() => remove(block)}
                  >
                    {text.remove}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={disabled || blocks.length >= 100}
        onClick={() => setTarget("new-image")}
      >
        {text.addContentImage}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={disabled || blocks.length >= 100}
        onClick={() => setTarget("new-document")}
      >
        {documents.addContentDocument}
      </Button>
      {error && <p role="alert">{text.documentLimit}</p>}
      {target && <Picker onCancel={() => setTarget(null)} onConfirm={choose} />}
    </fieldset>
  );
}
