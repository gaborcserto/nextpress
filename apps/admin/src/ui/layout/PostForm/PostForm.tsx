"use client";

import { useState } from "react";

import type { PostFormProps, PostFormValues, PostStatus } from "./PostForm.types";
import { slugify } from "@/lib/utils";
import { Button } from "@/ui/components/Buttons";
import { FormGrid12, Field } from "@/ui/components/FormGrid";
import type { MediaValue } from "@/ui/components/ImageUploader";
import Input from "@/ui/components/Input";
import { PostIntroFields } from "@/ui/components/PostIntroFields";
import Select from "@/ui/components/Select";
import StickyWrapper from "@/ui/components/StickyWrapper";
import TagsField from "@/ui/components/TagsField/TagsField";
import Section from "@/ui/layout/Section";
import { buildInitialForm, getEntityId } from "@/ui/utils/editorForm";

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
  const [form, setForm] = useState<PostFormValues>(() => buildInitialForm(initial));

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
      {/* LAYOUT: SIDEBAR (left) + MAIN (right) */}
      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* SIDEBAR */}
        <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-6 self-start">
          {/* CONTEXT */}
          {(sidebarTitle || sidebarSubtitle) && (
            <header className="h-20 flex flex-col justify-center space-y-1">
              <h1 className="text-2xl font-semibold">{sidebarTitle}</h1>
              <p className="text-base-content/70">{sidebarSubtitle}</p>
            </header>
          )}

          {/* TAGS */}
          <Section title="Tags" desc="Organize your post with tags.">
            <TagsField
              entityId={entityId}
              value={form.tags}
              onChangeAction={(tags) => setField("tags", tags)}
              persist={Boolean(entityId)}
            />
          </Section>
        </aside>

        {/* MAIN CONTENT */}
        <main className="lg:col-span-8 space-y-6 min-w-0 lg:pt-26">
          {/* BASIC INFO */}
          <Section title="Basic info" desc="Set title, slug and publication status.">
            <FormGrid12>
              {/* TITLE */}
              <Field label="Title" span={8}>
                <Input fullWidth value={form.title} onChange={(e) => onTitleChange(e.target.value)} required />
              </Field>

              {/* STATUS */}
              <Field label="Status" span={4}>
                <Select
                  fullWidth
                  value={form.status}
                  options={POST_STATUS_OPTIONS}
                  onChangeAction={(value) => setField("status", value as PostStatus)}
                />
              </Field>

              {/* SLUG */}
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

              {/* PUBLISH DATE */}
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

          {/* INTRO: EXCERPT + COVER */}
          <Section title="Intro" desc="Short lead text and optional cover image.">
            <PostIntroFields
              excerpt={form.excerpt}
              onExcerptChangeAction={(value: string) => setField("excerpt", value)}
              cover={form.cover}
              onCoverChangeAction={(media: MediaValue | null) => setField("cover", media)}
              onCoverAltChangeAction={(alt: string) =>
                setField("cover", form.cover ? { ...form.cover, alt } : null)
              }
              uploaderAction={imageUploadAction}
            />
          </Section>

          {/* CONTENT */}
          <Section title="Content" desc="Write or paste HTML content.">
            <textarea
              rows={16}
              className="textarea textarea-bordered w-full"
              value={form.content}
              onChange={(e) => setField("content", e.target.value)}
            />
          </Section>

          {/* ACTION BUTTONS (main width only) */}
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
