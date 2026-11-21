"use client";

import { pageLayouts } from "@nextpress/shared/content";
import Link from "next/link";
import { useState } from "react";

import {
  buildInitialForm,
  getEntityId,
  normalizeSlateValue,
} from "@/lib/content/editor";
import { useEditorSubmission } from "@/lib/content/useEditorSubmission";
import { usePrivateDraft } from "@/lib/content/usePrivateDraft";
import { useUnsavedChanges } from "@/lib/content/useUnsavedChanges";
import { slugify } from "@/lib/utils";
import {
  EventFields,
  EMPTY_SLATE_VALUE,
  ListingFields,
  PageTypeField,
  PublicationDatePicker,
  RedirectField,
  SlateEditor,
  TagMultiSelect,
  TagsField,
} from "@/ui/components";
import { Field, FormGrid12, Input, Select, Section } from "@/ui/primitives";
import { AdminPageColumns, AdminPageLayout } from "@/ui/shell/AdminPageLayout";

import { EditorActions } from "../EditorActions";
import LivePreview from "../LivePreview";
import { DocumentImageField } from "../Media/DocumentImageField";
import { CoverMediaField, GalleryMediaField } from "../Media/EditorMediaFields";
import { PageHierarchy } from "../PageHierarchy/PageHierarchy";
import {
  PrivateDraftRecovery,
  PrivateDraftStatus,
} from "../PrivateDraftStatus";

import type { PageFormValues } from "@/lib/content/contracts";

import type { PageFormProps } from "./PageForm.types";

const PAGE_STATUS_OPTIONS: readonly {
  value: PageFormValues["status"];
  label: string;
}[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
];

export default function PageForm({
  privateEditing,
  contentId,
  initial,
  onSubmitAction,
  submitting = false,
  submitLabel = "Save",
  loadTagOptionsAction,
  createTagAction,
  sidebarTitle,
  sidebarSubtitle,
}: PageFormProps) {
  // init state
  const [form, setForm] = useState<PageFormValues>(() => {
    const built = buildInitialForm(initial) as PageFormValues;

    return {
      ...built,
      content: normalizeSlateValue(built.content),
    };
  });

  const privateDraft = usePrivateDraft(form, setForm, privateEditing);
  const unsaved = useUnsavedChanges(form, false, privateDraft?.dirty);

  const [slugEdited, setSlugEdited] = useState<boolean>(Boolean(initial.slug));

  const setField = <K extends keyof PageFormValues>(
    key: K,
    value: PageFormValues[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onTitleChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      title: value,
      slug: slugEdited ? prev.slug : slugify(value),
    }));
  };

  const handleListingChange = (
    key: "listingKind" | "listingTaxonomyId",
    value: PageFormValues["listingKind"] | PageFormValues["listingTaxonomyId"],
  ) => {
    if (key === "listingKind") {
      setField("listingKind", value as PageFormValues["listingKind"]);
    } else {
      setField(
        "listingTaxonomyId",
        value as PageFormValues["listingTaxonomyId"],
      );
    }
  };

  const {
    handleSubmit,
    fieldErrors,
    clearFieldError,
    saveStatus,
    savedPublication,
  } = useEditorSubmission({
    form,
    setForm,
    submitting,
    dirty: unsaved.dirty,
    markSaved: unsaved.markSaved,
    savePrivateDraft: privateDraft?.save,
    onSubmitAction,
  });
  const entityId = contentId ?? getEntityId(initial);

  if (privateDraft?.recovering) {
    return (
      <AdminPageLayout title={sidebarTitle ?? "Page"} workspace="editor">
        <PrivateDraftRecovery draft={privateDraft} />
      </AdminPageLayout>
    );
  }

  return (
    <form id="admin-content-editor" onSubmit={handleSubmit}>
      {unsaved.dialog}
      <AdminPageLayout
        title={sidebarTitle ?? "Page"}
        description={sidebarSubtitle}
        workspace="editor"
      >
        <LivePreview
          kind="pages"
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
                  ? `/admin/pages/${entityId}/revisions`
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
                      <Field label="Status" htmlFor="page-status" span={12}>
                        <Select
                          id="page-status"
                          disabled={!!privateEditing}
                          fullWidth
                          value={form.status}
                          options={PAGE_STATUS_OPTIONS}
                          onChangeAction={(value) =>
                            setField(
                              "status",
                              value as PageFormValues["status"],
                            )
                          }
                        />
                      </Field>

                      <Field
                        label="Publish date"
                        htmlFor="page-published-at-date"
                        hint={
                          privateEditing
                            ? "Current public date. Use the private draft publication controls to publish or schedule."
                            : "A future date schedules publication when status is Published. Clear to publish immediately."
                        }
                        span={12}
                      >
                        <PublicationDatePicker
                          id="page-published-at"
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
                        Published content updates the live page immediately.
                        Choose Draft and save to withdraw it. Use Save to
                        persist changes.
                      </p>
                    )}
                  </Section>
                  <Section title="Tags" desc="Categorize page with tags.">
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

                  {contentId && (
                    <PageHierarchy id={contentId} pendingSlug={form.slug} />
                  )}
                  <Section title="Navigation">
                    <Link href="/admin/settings/menus" className="underline">
                      Manage menu placement
                    </Link>
                  </Section>
                </>
              }
            >
              <Section title="Document details">
                <FormGrid12>
                  <Field label="Title" htmlFor="page-title" span={12}>
                    <Input
                      id="page-title"
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
                    htmlFor="page-slug"
                    hint="Auto-generated from title until you edit it."
                    span={8}
                  >
                    <Input
                      id="page-slug"
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

                  <Field
                    label="Page type"
                    htmlFor="page-type"
                    hint={
                      form.type === pageLayouts.home
                        ? "Appears at the site root when published and due. Only one published or scheduled Home page can be assigned."
                        : undefined
                    }
                    span={4}
                  >
                    <PageTypeField
                      id="page-type"
                      value={form.type}
                      onChange={(v) => setField("type", v)}
                    />
                  </Field>
                </FormGrid12>
              </Section>

              <div className="grid gap-4">
                <CoverMediaField
                  value={form.cover}
                  onChange={(media) => setField("cover", media)}
                  readOnly={Boolean(privateEditing)}
                  disabled={submitting}
                />
                {form.type === pageLayouts.gallery && (
                  <GalleryMediaField
                    value={form.gallery ?? []}
                    onChange={(media) => setField("gallery", media)}
                    readOnly={Boolean(privateEditing)}
                    disabled={submitting}
                  />
                )}
              </div>
              {!privateEditing && form.pageDocument !== undefined && (
                <DocumentImageField
                  value={form.pageDocument}
                  onChange={(document) => setField("pageDocument", document)}
                  disabled={submitting}
                />
              )}
              {form.type === pageLayouts.posts && (
                <Section
                  title="Posts listing"
                  desc="Leave the filter empty to display all published posts."
                >
                  <TagMultiSelect
                    label="Filter by tag"
                    placeholder="Search existing tags"
                    value={
                      form.listingTaxonomyId
                        ? [
                            form.listingTag ?? {
                              id: form.listingTaxonomyId,
                              name: form.listingTaxonomyId,
                              slug: form.listingTaxonomyId,
                            },
                          ]
                        : []
                    }
                    onChangeAction={(tags) => {
                      const listingTag = tags.at(-1) ?? null;
                      setForm((current) => ({
                        ...current,
                        listingTag,
                        listingTaxonomyId: listingTag?.id ?? null,
                      }));
                    }}
                    loadOptionsAction={loadTagOptionsAction}
                  />
                </Section>
              )}

              {form.type === "LISTING" && (
                <Section
                  title="Listing configuration"
                  desc="Listing configuration is not available yet."
                >
                  <fieldset disabled>
                    <ListingFields
                      listingKind={form.listingKind}
                      listingTaxonomyId={form.listingTaxonomyId}
                      onChangeAction={handleListingChange}
                    />
                  </fieldset>
                </Section>
              )}

              {form.type === "EVENT_PAGE" && (
                <Section
                  title="Event details"
                  desc="Event details cannot be edited yet."
                >
                  <fieldset disabled>
                    <EventFields
                      values={form}
                      onChangeAction={(key, value) => setField(key, value)}
                    />
                  </fieldset>
                </Section>
              )}

              {form.type === "REDIRECT" && (
                <Section
                  title="Redirect"
                  desc="Redirect targets cannot be edited yet."
                >
                  <fieldset disabled>
                    <RedirectField
                      value={form.redirectTo}
                      onChangeAction={(value) => setField("redirectTo", value)}
                    />
                  </fieldset>
                </Section>
              )}

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
