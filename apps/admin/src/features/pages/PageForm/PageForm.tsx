"use client";

import { pageLayouts } from "@nextpress/shared/content";
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
import {
  CoverMediaField,
  GalleryMediaField,
} from "@/features/media/editor-fields/EditorMediaFields";
import { TagMultiSelect } from "@/features/taxonomy/TagMultiSelect";
import { TagsField } from "@/features/taxonomy/TagsField";
import { useAdminLocale } from "@/lib/i18n/admin-locale";
import { EMPTY_SLATE_VALUE, SlateEditor } from "@/ui/components";
import { Field, FormGrid12, Input, Select, Section } from "@/ui/primitives";
import { AdminPageColumns, AdminPageLayout } from "@/ui/shell/AdminPageLayout";

import { EventFields } from "../EventFields";
import { ListingFields } from "../ListingFields";
import { pageWorkingPatch } from "../page.client";
import { PageTypeField } from "../PageTypeField";
import { RedirectField } from "../RedirectField";

import type { PageFormValues } from "@/features/content/editor/contracts";

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
  const hu = useAdminLocale() === "hu";
  // init state
  const [form, setForm] = useState<PageFormValues>(() => {
    const built = buildInitialForm(initial) as PageFormValues;

    return {
      ...built,
      content: normalizeSlateValue(built.content),
    };
  });

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
    formPatch: pageWorkingPatch,
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
                        htmlFor="page-published-at-datetime"
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
                  {form.type === pageLayouts.posts && (
                    <Section
                      title="Posts listing"
                      desc="Leave the filter empty to display all published posts."
                    >
                      <TagMultiSelect
                        className="min-w-0"
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
                  {entityId && <DocumentId id={entityId} />}
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

                  <Field label="Page type" htmlFor="page-type" span={4}>
                    <PageTypeField
                      id="page-type"
                      value={form.type}
                      pageId={contentId}
                      onChange={(v) => setField("type", v)}
                    />
                  </Field>
                </FormGrid12>
              </Section>

              {form.type !== pageLayouts.standard && (
                <Section title={hu ? "Összefoglaló" : "Summary"}>
                  <div className="w-full min-w-0 space-y-4">
                    <CoverMediaField
                      value={form.cover}
                      onChange={(media) => setField("cover", media)}
                      readOnly={Boolean(privateEditing)}
                    />
                    {form.type === pageLayouts.gallery && (
                      <GalleryMediaField
                        value={form.gallery ?? []}
                        onChange={(media) => setField("gallery", media)}
                        readOnly={Boolean(privateEditing)}
                      />
                    )}
                  </div>
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
            </AdminPageColumns>
          </fieldset>
        </LivePreview>
      </AdminPageLayout>
    </form>
  );
}
