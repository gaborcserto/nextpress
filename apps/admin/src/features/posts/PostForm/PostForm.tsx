"use client";

import { slugify } from "@nextpress/shared/slugify";
import { useState } from "react";

import DocumentId from "@/features/content/DocumentId";
import {
  buildInitialForm,
  getEntityId,
  normalizeSlateValue,
} from "@/features/content/editor/editor";
import { EditorActions } from "@/features/content/editor/EditorActions";
import { useEditorSubmission } from "@/features/content/editor/useEditorSubmission";
import LivePreview from "@/features/content/LivePreview/LivePreview";
import {
  PrivateDraftRecovery,
  PrivateDraftStatus,
} from "@/features/content/private-drafts/PrivateDraftStatus";
import PublicationDatePicker from "@/features/content/PublicationDatePicker/PublicationDatePicker";
import { DocumentImageField } from "@/features/media/editor-fields/DocumentImageField";
import { CoverMediaField } from "@/features/media/editor-fields/EditorMediaFields";
import { TagsField } from "@/features/taxonomy/TagsField";
import { useAdminLocale } from "@/lib/i18n/admin-locale";
import { EMPTY_SLATE_VALUE, SlateEditor } from "@/ui/components";
import { FormGrid12, Field, Input, Section, Select } from "@/ui/primitives";
import { AdminPageColumns, AdminPageLayout } from "@/ui/shell/AdminPageLayout";

import { postWorkingPatch } from "../post.client";
import { PostIntroFields } from "../PostIntroFields";

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
  loadTagOptionsAction,
  createTagAction,
  sidebarTitle,
  sidebarSubtitle,
}: PostFormProps) {
  const hu = useAdminLocale() === "hu";
  // Generate a missing slug from an existing title.
  const [form, setForm] = useState<PostFormValues>(() => {
    const built = buildInitialForm(initial);

    return {
      ...built,
      excerpt: normalizeSlateValue(initial.excerpt),
      content: normalizeSlateValue(initial.content),
    } as PostFormValues;
  });

  // An existing custom slug remains independent of the title.
  const [slugEdited, setSlugEdited] = useState<boolean>(() => {
    if (!initial.title || !initial.slug) {
      return false;
    }

    const autoSlug = slugify(initial.title);

    return initial.slug !== autoSlug;
  });
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

  const {
    privateDraft,
    unsaved,
    handleSubmit,
    fieldErrors,
    clearFieldError,
    saveStatus,
    savedPublication,
  } = useEditorSubmission({
    form,
    setForm,
    submitting,
    privateEditing,
    formPatch: postWorkingPatch,
    onSubmitAction,
  });
  const entityId = contentId ?? getEntityId(initial);

  if (privateDraft?.recovering) {
    return (
      <AdminPageLayout title={sidebarTitle ?? "Post"} workspace="editor">
        <PrivateDraftRecovery draft={privateDraft} />
      </AdminPageLayout>
    );
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
          privateSnapshot={privateDraft?.savedPreview}
          values={form}
          renderHeader={(preview) => (
            <EditorActions
              publication={
                privateDraft?.publicState ?? savedPublication ?? initial
              }
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
          <fieldset inert={submitting && !privateEditing} className="contents">
            <AdminPageColumns
              content={
                <Section title="Content">
                  {!privateEditing && form.pageDocument !== undefined ? (
                    <DocumentImageField
                      value={form.pageDocument}
                      onChange={(document) =>
                        setField("pageDocument", document)
                      }
                      renderEditor={() => (
                        <SlateEditor
                          key={privateDraft?.contentKey ?? 0}
                          value={form.content ?? EMPTY_SLATE_VALUE}
                          onChangeAction={(val) => setField("content", val)}
                        />
                      )}
                    />
                  ) : (
                    <SlateEditor
                      key={privateDraft?.contentKey ?? 0}
                      value={form.content ?? EMPTY_SLATE_VALUE}
                      onChangeAction={(val) => setField("content", val)}
                    />
                  )}
                </Section>
              }
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
                        htmlFor="post-published-at-datetime"
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
                  </Section>
                  <Section title="Tags">
                    <TagsField
                      value={form.tags}
                      onChangeAction={(tags) => setField("tags", tags)}
                      loadOptionsAction={loadTagOptionsAction}
                      createTagAction={createTagAction}
                      persist={false}
                    />
                  </Section>
                  {entityId && <DocumentId id={entityId} />}
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
                        clearFieldError("title");

                        if (!slugEdited) {
                          clearFieldError("slug");
                        }
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
                        clearFieldError("slug");
                      }}
                      required
                      error={fieldErrors.slug}
                    />
                  </Field>
                </FormGrid12>
              </Section>

              <Section title={hu ? "Összefoglaló" : "Summary"}>
                <div className="w-full min-w-0 space-y-4">
                  <PostIntroFields
                    key={privateDraft?.contentKey ?? 0}
                    excerpt={form.excerpt ?? EMPTY_SLATE_VALUE}
                    onExcerptChangeAction={(value) =>
                      setField("excerpt", value)
                    }
                  />
                  <CoverMediaField
                    value={form.cover}
                    onChange={(media) => setField("cover", media)}
                    readOnly={Boolean(privateEditing)}
                  />
                </div>
              </Section>
            </AdminPageColumns>
          </fieldset>
        </LivePreview>
      </AdminPageLayout>
    </form>
  );
}
