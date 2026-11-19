"use client";

import { ImageUploader } from "@/ui/components/ImageUploader";
import { SlateEditor, EMPTY_SLATE_VALUE } from "@/ui/components/SlateEditor";
import { Field, Input } from "@/ui/primitives";

import type { PostIntroFieldsProps } from "./PostIntroFields.types";

export function PostIntroFields({
  disabled,
  excerpt,
  onExcerptChangeAction,
  cover,
  onCoverChangeAction,
  onCoverAltChangeAction,
  uploaderAction,
}: PostIntroFieldsProps) {
  return (
    <div className="grid min-w-0 gap-5">
      <Field
        label="Excerpt (lead)"
        hint="Short intro used on listing pages and social previews."
      >
        <SlateEditor
          compact
          readOnly={disabled}
          label="Excerpt (lead)"
          value={excerpt ?? EMPTY_SLATE_VALUE}
          onChangeAction={onExcerptChangeAction}
        />
      </Field>

      <Field
        label="Cover image"
        hint="Cover image editing is not available yet."
      >
        <ImageUploader
          disabled
          value={cover}
          onChangeAction={onCoverChangeAction}
          uploaderAction={uploaderAction}
        />

        {cover && (
          <div className="mt-2">
            <label className="label" htmlFor="post-cover-alt">
              <span className="label-text">Alt text</span>
            </label>

            <Input
              id="post-cover-alt"
              disabled
              fullWidth
              placeholder="Describe the image for accessibility and SEO"
              value={cover.alt ?? ""}
              onChange={(e) => onCoverAltChangeAction(e.target.value)}
            />
          </div>
        )}
      </Field>
    </div>
  );
}
