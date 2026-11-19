"use client";

import { useState, type FormEvent } from "react";

import {
  buildInitialForm,
  getEntityId,
  normalizeSlateValue,
} from "@/lib/content/editor";
import { usePrivateDraft } from "@/lib/content/usePrivateDraft";
import { useUnsavedChanges } from "@/lib/content/useUnsavedChanges";
import { slugify } from "@/lib/utils";
import {
  EMPTY_SLATE_VALUE,
  PostIntroFields,
  PublicationDatePicker,
  SlateEditor,
  TagsField,
} from "@/ui/components";
import { FormGrid12, Field, Input, Section, Select } from "@/ui/primitives";
import { AdminPageColumns, AdminPageLayout } from "@/ui/shell/AdminPageLayout";

import { EditorActions } from "../EditorActions";
import LivePreview from "../LivePreview";
import { PrivateDraftStatus } from "../PrivateDraftStatus";

import type { MediaValue } from "@/lib/content/contracts";

import type {
  PostFormProps,
  PostFormValues,
  PostStatus,
} from "./PostForm.types";

const POST_STATUS_OPTIONS: readonly { value: PostStatus; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
];

export default function PostForm({
  privateEditing,
  contentId,
  initial,
  onSubmitAction,
  submitting = false,
  submitLabel = "Save post",
  imageUploadAction,
  loadTagOptionsAction,
  createTagAction,
  sidebarTitle,
  sidebarSubtitle,
}: PostFormProps) {
  /**
   * Init state:
   *  - If slug is empty AND title exists â†’ generate slug on mount
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
  const privateDraft = usePrivateDraft(form, setForm, privateEditing);
  const unsaved = useUnsavedChanges(form, false, privateDraft?.dirty);

  const [slugEdited, setSlugEdited] = useState<boolean>(() => {
    if (!initial.title || !initial.slug) {
      return false;
    }

    const autoSlug = slugify(initial.title);

    return initial.slug !== autoSlug;
  });
  const [hasSaved, setHasSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    slug?: string;
  }>({});

  /** Named setter for specific field */
  const setField = <K extends keyof PostFormValues>(
    key: K,
    value: PostFormValues[K],
  ) => {
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const errors = {
      ...(form.title.trim() ? {} : { title: "Title is required." }),
      ...(form.slug.trim() ? {} : { slug: "Slug is required." }),
    };
    setFieldErrors(errors);

    if (Object.keys(errors).length) {
      return;
    }

    setSaveFailed(false);

    if (privateDraft) {
      await privateDraft.save();

      return;
    }

    if ((await onSubmitAction(form)) === true) {
      unsaved.markSaved();
      setHasSaved(true);
    } else {
      setSaveFailed(true);
    }
  };

  const entityId = contentId ?? getEntityId(initial);
  let saveStatus = hasSaved ? "Saved" : "No unsaved changes";

  if (submitting) {
    saveStatus = "Saving...";
  } else if (saveFailed) {
    saveStatus = "Save failed. Your edits are retained. Retry saving.";
  } else if (unsaved.dirty) {
    saveStatus = "Unsaved changes";
  }

  return (
    <form id="admin-content-editor" onSubmit={handleSubmit}>
      {unsaved.dialog}
      <AdminPageLayout
        title={sidebarTitle ?? "Post"}
        description={sidebarSubtitle}
        workspace="editor"
      >
        <LivePreview
          kind="posts"
          id={entityId}
          savedContent={initial}
          values={form}
          renderHeader={(preview) => (
            <EditorActions
              status={privateDraft?.publicStatus ?? form.status}
              saveStatus={saveStatus}
              submitLabel={submitLabel}
              saving={
                privateDraft ? privateDraft.phase === "saving" : submitting
              }
              revisionsHref={
                entityId && !privateEditing
                  ? `/admin/posts/${entityId}/revisions`
                  : undefined
              }
              privateDraft={privateDraft}
              preview={preview}
              onCancelAction={() =>
                unsaved.requestNavigation(() => history.back())
              }
            />
          )}
        >
          <fieldset
            disabled={submitting && !privateEditing}
            className="contents"
          >
            <AdminPageColumns
              sidebar={
                <>
                  {privateDraft && <PrivateDraftStatus draft={privateDraft} />}
                  <Section
                    title={privateEditing ? "Public details" : "Publishing"}
                  >
                    <FormGrid12>
                      <Field label="Status" htmlFor="post-status" span={12}>
                        <Select
                          id="post-status"
                          disabled={!!privateEditing}
                          fullWidth
                          value={form.status}
                          options={POST_STATUS_OPTIONS}
                          onChangeAction={(value) =>
                            setField("status", value as PostStatus)
                          }
                        />
                      </Field>

                      <Field
                        label="Publish date"
                        htmlFor="post-published-at"
                        hint={
                          privateEditing
                            ? "Current public date. Use the private draft publication controls to publish or schedule."
                            : "Your local time. A future date schedules publication when status is Published. Clear to publish immediately."
                        }
                        span={12}
                      >
                        <PublicationDatePicker
                          id="post-published-at"
                          disabled={!!privateEditing}
                          value={form.publishedAt ?? null}
                          onChange={(value) => setField("publishedAt", value)}
                        />
                      </Field>
                    </FormGrid12>
                    {!privateEditing && (
                      <p className="mt-3 text-sm text-(--text-muted)">
                        Draft saves stay private. Published content is public
                        only when its date is due; a future date is scheduled,
                        and a missing date is not publicly visible. Saving due
                        Published content updates the live post immediately.
                        Choose Draft and save to withdraw it. Use Save to
                        persist changes.
                      </p>
                    )}
                  </Section>
                  <Section title="Tags" desc="Organize your post with tags.">
                    <p className="text-sm mb-3">
                      Tag assignments save with the form. Cancel discards
                      unsaved assignments.
                    </p>
                    <TagsField
                      value={form.tags}
                      onChangeAction={(tags) => setField("tags", tags)}
                      loadOptionsAction={loadTagOptionsAction}
                      createTagAction={createTagAction}
                      persist={false}
                    />
                  </Section>
                </>
              }
            >
              <Section title="Document details">
                <FormGrid12>
                  <Field label="Title" htmlFor="post-title" span={7}>
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

                  <Field
                    label="Slug"
                    htmlFor="post-slug"
                    hint="Auto-generates from title until you edit it."
                    span={5}
                  >
                    <Input
                      id="post-slug"
                      fullWidth
                      value={form.slug}
                      onChange={(e) => {
                        setSlugEdited(true);
                        setField("slug", slugify(e.target.value));
                        setFieldErrors((current) => ({
                          ...current,
                          slug: undefined,
                        }));
                      }}
                      required
                      error={fieldErrors.slug}
                    />
                  </Field>
                </FormGrid12>
              </Section>

              <Section
                title="Intro"
                desc="Short lead text and an optional cover image."
              >
                <PostIntroFields
                  key={privateDraft?.contentKey ?? 0}
                  disabled={submitting}
                  excerpt={form.excerpt ?? EMPTY_SLATE_VALUE}
                  onExcerptChangeAction={(value) => setField("excerpt", value)}
                  cover={form.cover}
                  onCoverChangeAction={(media: MediaValue | null) =>
                    setField("cover", media)
                  }
                  onCoverAltChangeAction={(alt: string) =>
                    setField(
                      "cover",
                      form.cover ? { ...form.cover, alt } : null,
                    )
                  }
                  uploaderAction={imageUploadAction}
                />
              </Section>

              <Section title="Content">
                <SlateEditor
                  key={privateDraft?.contentKey ?? 0}
                  readOnly={submitting}
                  value={form.content ?? EMPTY_SLATE_VALUE}
                  onChangeAction={(val) => setField("content", val)}
                />
              </Section>
            </AdminPageColumns>
          </fieldset>
        </LivePreview>
      </AdminPageLayout>
    </form>
  );
}
