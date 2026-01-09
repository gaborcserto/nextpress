"use client";

import { useState } from "react";

import type { PostFormProps, PostFormValues, PostStatus } from "./PostForm.types";
import { slugify } from "@/lib/utils";
import {
  EMPTY_SLATE_VALUE,
  PostIntroFields,
  SlateEditor,
  TagsField,
  type MediaValue,
} from "@/ui/components";
import {
  Button,
  FormGrid12,
  Field,
  Input,
  Section,
  Select,
  StickyWrapper
} from "@/ui/primitives"
import { buildInitialForm, getEntityId, normalizeSlateValue} from "@/ui/utils";

const POST_STATUS_OPTIONS: readonly { value: PostStatus; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
];

export default function PostForm({
  initial,
  onSubmitAction,
  submitting = false,
  submitLabel = "Save post",
  imageUploadAction,
  sidebarTitle,
  sidebarSubtitle,
}: PostFormProps) {
  /**
   * Init state:
   *  - If slug is empty AND title exists → generate slug on mount
   */
  const [form, setForm] = useState<PostFormValues>(() => {
    const built = buildInitialForm(initial);

    return {
      ...built,
      excerpt: normalizeSlateValue(initial.excerpt),
      content: normalizeSlateValue(initial.content),
    } as PostFormValues;
  });

  // Track if slug was manually edited:
  // true only if initial.slug differs from auto-generated slug
  const [slugEdited, setSlugEdited] = useState<boolean>(() => {
    if (!initial.title || !initial.slug) return false;
    const autoSlug = slugify(initial.title);
    return initial.slug !== autoSlug;
  });

  /** Named setter for specific field */
  const setField = <K extends keyof PostFormValues>(key: K, value: PostFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /** Auto-update slug unless user manually edited it */
  const onTitleChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      title: value,
      slug: slugEdited ? prev.slug : slugify(value),
    }));
  };

  const handleSubmit = () => {
    onSubmitAction(form);
  };

  const entityId = getEntityId(initial);

  return (
    <div className="space-y-6 w-full">
      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-6 self-start">
          {(sidebarTitle || sidebarSubtitle) && (
            <header className="h-20 flex flex-col justify-center space-y-1">
              <h1 className="text-2xl font-semibold">{sidebarTitle}</h1>
              <p className="text-base-content/70">{sidebarSubtitle}</p>
            </header>
          )}

          <Section title="Tags" desc="Organize your post with tags.">
            <TagsField
              entityId={entityId}
              value={form.tags}
              onChangeAction={(tags) => setField("tags", tags)}
              persist={Boolean(entityId)}
            />
          </Section>
        </aside>

        <main className="lg:col-span-8 space-y-6 min-w-0 lg:pt-26">
          <Section title="Basic info" desc="Set title, slug and publication status.">
            <FormGrid12>
              <Field label="Title" span={8}>
                <Input fullWidth value={form.title} onChange={(e) => onTitleChange(e.target.value)} required />
              </Field>

              <Field label="Status" span={4}>
                <Select
                  fullWidth
                  value={form.status}
                  options={POST_STATUS_OPTIONS}
                  onChangeAction={(value) => setField("status", value as PostStatus)}
                />
              </Field>

              <Field label="Slug" hint="Auto-generates from title until you edit it." span={8}>
                <Input
                  fullWidth
                  value={form.slug}
                  onChange={(e) => {
                    setSlugEdited(true);
                    setField("slug", slugify(e.target.value));
                  }}
                  required
                />
              </Field>

              <Field label="Publish date" hint="Leave empty to publish immediately when status is PUBLISHED." span={4}>
                <Input
                  type="datetime-local"
                  fullWidth
                  value={form.publishedAt ?? ""}
                  onChange={(e) => setField("publishedAt", e.target.value || null)}
                />
              </Field>
            </FormGrid12>
          </Section>

          <Section title="Intro" desc="Short lead text and optional cover image.">
            <PostIntroFields
              excerpt={form.excerpt ?? EMPTY_SLATE_VALUE}
              onExcerptChangeAction={(value) => setField("excerpt", value)}
              cover={form.cover}
              onCoverChangeAction={(media: MediaValue | null) => setField("cover", media)}
              onCoverAltChangeAction={(alt: string) =>
                setField("cover", form.cover ? { ...form.cover, alt } : null)
              }
              uploaderAction={imageUploadAction}
            />
          </Section>

          <Section title="Content" desc="Write your content.">
            <SlateEditor value={form.content ?? EMPTY_SLATE_VALUE} onChangeAction={(val) => setField("content", val)} />
          </Section>

          <StickyWrapper>
            <Button variant="ghost" color="neutral" onClick={() => history.back()}>
              Cancel
            </Button>
            <Button color="primary" className="min-w-30" loading={submitting} onClick={handleSubmit}>
              {submitLabel}
            </Button>
          </StickyWrapper>
        </main>
      </div>
    </div>
  );
}
