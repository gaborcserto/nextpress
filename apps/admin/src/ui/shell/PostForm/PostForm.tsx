"use client";

import { useState, type FormEvent } from "react";

import type { PostFormProps, PostFormValues, PostStatus } from "./PostForm.types";
import type { MediaValue } from "@/lib/content/contracts";
import {
  buildInitialForm,
  getEntityId,
  normalizeSlateValue,
} from "@/lib/content/editor";
import { slugify } from "@/lib/utils";
import {
  EMPTY_SLATE_VALUE,
  PostIntroFields,
  SlateEditor,
  TagsField,
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
import { AdminPageColumns, AdminPageLayout } from "@/ui/shell/AdminPageLayout";

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
  loadTagOptionsAction,
  createTagAction,
  loadEntityTagsAction,
  updateEntityTagsAction,
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
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; slug?: string }>({});

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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const errors = {
      ...(form.title.trim() ? {} : { title: "Title is required." }),
      ...(form.slug.trim() ? {} : { slug: "Slug is required." }),
    };
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    onSubmitAction(form);
  };

  const entityId = getEntityId(initial);

  return (
    <form onSubmit={handleSubmit}>
    <AdminPageLayout title={sidebarTitle ?? "Post"} description={sidebarSubtitle}>
      <fieldset disabled={submitting} className="contents">
      <AdminPageColumns sidebar={
        <>
          <Section title="Tags" desc="Organize your post with tags.">
            <TagsField
              entityId={entityId}
              value={form.tags}
              onChangeAction={(tags) => setField("tags", tags)}
              loadOptionsAction={loadTagOptionsAction}
              createTagAction={createTagAction}
              loadEntityTagsAction={loadEntityTagsAction}
              updateEntityTagsAction={updateEntityTagsAction}
              persist={Boolean(entityId)}
            />
          </Section>
        </>
      }>

          <Section title="Basic info" desc="Set title, slug and publication status.">
            <FormGrid12>
              <Field label="Title" htmlFor="post-title" span={8}>
                <Input
                  id="post-title"
                  fullWidth
                  value={form.title}
                  onChange={(e) => {
                    onTitleChange(e.target.value);
                    setFieldErrors((current) => ({
                      ...current,
                      title: undefined,
                      slug: slugEdited ? current.slug : undefined,
                    }));
                  }}
                  required
                  error={fieldErrors.title}
                />
              </Field>

              <Field label="Status" htmlFor="post-status" span={4}>
                <Select
                  id="post-status"
                  fullWidth
                  value={form.status}
                  options={POST_STATUS_OPTIONS}
                  onChangeAction={(value) => setField("status", value as PostStatus)}
                />
              </Field>

              <Field label="Slug" htmlFor="post-slug" hint="Auto-generates from title until you edit it." span={8}>
                <Input
                  id="post-slug"
                  fullWidth
                  value={form.slug}
                  onChange={(e) => {
                    setSlugEdited(true);
                    setField("slug", slugify(e.target.value));
                    setFieldErrors((current) => ({ ...current, slug: undefined }));
                  }}
                  required
                  error={fieldErrors.slug}
                />
              </Field>

              <Field label="Publish date" htmlFor="post-published-at" hint="Leave empty to publish immediately when status is PUBLISHED." span={4}>
                <Input
                  id="post-published-at"
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
              disabled={submitting}
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
            <SlateEditor readOnly={submitting} value={form.content ?? EMPTY_SLATE_VALUE} onChangeAction={(val) => setField("content", val)} />
          </Section>

          <StickyWrapper>
            <Button type="button" variant="ghost" color="neutral" onClick={() => history.back()}>
              Cancel
            </Button>
            <Button type="submit" color="primary" className="min-w-30" loading={submitting}>
              {submitLabel}
            </Button>
          </StickyWrapper>
      </AdminPageColumns>
      </fieldset>
    </AdminPageLayout>
    </form>
  );
}
