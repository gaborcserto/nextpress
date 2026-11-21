"use client";

import {
  PageDocumentSchema,
  type PageBlock,
  type PageDocument,
} from "@nextpress/shared/page-document";
import { useState } from "react";

import { Button } from "@/ui/primitives";

import { MediaPicker } from "./MediaPicker";
import { useMediaMessages } from "./messages";

import type { EditorImage } from "@nextpress/shared/media";

type ImageBlock = Extract<PageBlock, { type: "hero" | "image" }>;

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
  const [target, setTarget] = useState<ImageBlock | "new" | null>(null);
  const [error, setError] = useState(false);
  const blocks = value?.blocks ?? [];
  const images = blocks
    .flatMap((block) =>
      block.type === "columns" ? block.regions.flat() : [block],
    )
    .filter((block) => block.type === "image" || block.type === "hero");

  function update(next: PageBlock[]) {
    const result = PageDocumentSchema.safeParse({ version: 1, blocks: next });
    setError(!result.success);

    if (result.success) {
      onChange(result.data);
    }
  }

  function changeBlock(id: string, replacement?: ImageBlock) {
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

  function choose([asset]: EditorImage[]) {
    if (!asset || !target) {
      return;
    }

    if (target === "new") {
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

  function remove(block: ImageBlock) {
    if (block.type === "image") {
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

  return (
    <fieldset className="mt-4 min-w-0 space-y-2">
      <legend className="font-semibold">{text.contentImages}</legend>
      {images.length > 0 && (
        <ul className="grid gap-2">
          {images.map((block) => (
            <li key={block.id} className="grid gap-2">
              <span className="wrap-anywhere">
                {block.type === "hero"
                  ? block.props.title
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
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => setTarget(block)}
                >
                  {text.choose}
                </Button>
                {block.props.mediaId && (
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
        onClick={() => setTarget("new")}
      >
        {text.addContentImage}
      </Button>
      {error && <p role="alert">{text.documentLimit}</p>}
      {target && (
        <MediaPicker onCancel={() => setTarget(null)} onConfirm={choose} />
      )}
    </fieldset>
  );
}
