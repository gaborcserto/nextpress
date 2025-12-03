"use client";

import type { PostIntroFieldsProps } from "./PostIntroFields.types";
import { FormGrid12, Field } from "@/ui/components/FormGrid";
import ImageUploader from "@/ui/components/ImageUploader";
import Input from "@/ui/components/Input";

/**
 * Intro section of a post:
 * - excerpt (lead text)
 * - optional cover image + alt text
 */
export function PostIntroFields({
  excerpt,
  onExcerptChangeAction,
  cover,
  onCoverChangeAction,
  onCoverAltChangeAction,
  uploaderAction,
}: PostIntroFieldsProps) {
  return (
    <FormGrid12>
      <Field
        label="Excerpt (lead)"
        hint="Short intro used on listing pages and social previews."
        span={7}
      >
        <textarea
          rows={4}
          className="textarea textarea-bordered w-full"
          value={excerpt}
          onChange={(e) => onExcerptChangeAction(e.target.value)}
        />
      </Field>

      <Field
        label="Cover image"
        hint="Optional featured image for this post."
        span={5}
      >
        <ImageUploader
          value={cover}
          onChangeAction={onCoverChangeAction}
          uploaderAction={uploaderAction}
        />

        {/* Alt text only visible when there is a cover image */}
        {cover && (
          <div className="mt-2">
            <label className="label">
              <span className="label-text">Alt text</span>
            </label>

            <Input
              fullWidth
              placeholder="Describe the image for accessibility and SEO"
              value={cover.alt ?? ""}
              onChange={(e) => onCoverAltChangeAction(e.target.value)}
            />
          </div>
        )}
      </Field>
    </FormGrid12>
  );
}
