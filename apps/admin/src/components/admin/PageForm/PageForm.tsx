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
  EventFields,
  EMPTY_SLATE_VALUE,
  ListingFields,
  MenuPlacementField,
  PageTypeField,
  PublicationDatePicker,
  RedirectField,
  SlateEditor,
  TagsField,
} from "@/ui/components";
import { Field, FormGrid12, Input, Select, Section } from "@/ui/primitives";
import { AdminPageColumns, AdminPageLayout } from "@/ui/shell/AdminPageLayout";

import { EditorActions } from "../EditorActions";
import LivePreview from "../LivePreview";
import { PrivateDraftStatus } from "../PrivateDraftStatus";

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
  const [hasSaved, setHasSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    slug?: string;
  }>({});

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
        title={sidebarTitle ?? "Page"}
        description={sidebarSubtitle}
        workspace="editor"
      >
        <LivePreview
          kind="pages"
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
                        htmlFor="page-published-at"
                        hint={
                          privateEditing
                            ? "Current public date. Use the private draft publication controls to publish or schedule."
                            : "Your local time. A future date schedules publication when status is Published. Clear to publish immediately."
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

                  <Section
                    title="Hierarchy"
                    desc="Parent selection is not available yet. Existing relationships are preserved."
                  >
                    <p className="text-sm">
                      {form.parentId
                        ? "A parent page is assigned."
                        : "No parent page is assigned."}
                    </p>
                  </Section>

                  <Section
                    title="Menu placement"
                    desc="Where should this page appear?"
                  >
                    <MenuPlacementField
                      inHeader={form.inHeaderMenu}
                      inFooter={form.inFooterMenu}
                      onChangeAction={(key, value) => setField(key, value)}
                    />
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
                        setFieldErrors((current) => ({
                          ...current,
                          slug: undefined,
                        }));
                      }}
                      required
                      error={fieldErrors.slug}
                    />
                  </Field>

                  <Field
                    label="Layout"
                    htmlFor="page-type"
                    hint="Only Standard is available for new pages. Existing layouts are preserved."
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
