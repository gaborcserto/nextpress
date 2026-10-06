"use client";

import { useState, type FormEvent } from "react";

import type { PageFormProps } from "./PageForm.types";
import type { PageFormValues } from "@/lib/content/contracts";
import {
  buildInitialForm,
  getEntityId,
  normalizeSlateValue,
} from "@/lib/content/editor";
import { slugify } from "@/lib/utils";
import {
  EventFields,
  EMPTY_SLATE_VALUE,
  HierarchyField,
  ListingFields,
  MenuPlacementField,
  PageTypeField,
  RedirectField,
  SlateEditor,
  TagsField,
} from "@/ui/components";
import {
  Button,
  Field,
  FormGrid12,
  Input,
  Select,
  Section,
  StickyWrapper,
} from "@/ui/primitives";
import { AdminPageColumns, AdminPageLayout } from "@/ui/shell/AdminPageLayout";

const PAGE_STATUS_OPTIONS: readonly { value: PageFormValues["status"]; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
];

export default function PageForm({
  initial,
  onSubmitAction,
  submitting = false,
  submitLabel = "Save",
  loadTagOptionsAction,
  createTagAction,
  loadEntityTagsAction,
  updateEntityTagsAction,
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

  const [slugEdited, setSlugEdited] = useState<boolean>(Boolean(initial.slug));
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; slug?: string }>({});

  const setField = <K extends keyof PageFormValues>(key: K, value: PageFormValues[K]) => {
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
    value: PageFormValues["listingKind"] | PageFormValues["listingTaxonomyId"]
  ) => {
    if (key === "listingKind") {
      setField("listingKind", value as PageFormValues["listingKind"]);
    } else {
      setField("listingTaxonomyId", value as PageFormValues["listingTaxonomyId"]);
    }
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
    <AdminPageLayout title={sidebarTitle ?? "Page"} description={sidebarSubtitle}>
      <fieldset disabled={submitting} className="contents">
      <AdminPageColumns sidebar={
        <>
          <Section title="Tags" desc="Categorize page with tags.">
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

          <Section title="Hierarchy" desc="Parent selection is not available yet. Existing relationships are preserved.">
            <fieldset disabled>
              <HierarchyField parentId={form.parentId} onChangeAction={(value) => setField("parentId", value)} />
            </fieldset>
          </Section>

          <Section title="Menu placement" desc="Where should this page appear?">
            <MenuPlacementField
              inHeader={form.inHeaderMenu}
              inFooter={form.inFooterMenu}
              onChangeAction={(key, value) => setField(key, value)}
            />
          </Section>
        </>
      }>

          <Section title="Basic info" desc="Set title, status, slug and layout.">
            <FormGrid12>
              <Field label="Title" htmlFor="page-title" span={8}>
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

              <Field label="Status" htmlFor="page-status" span={4}>
                <Select
                  id="page-status"
                  fullWidth
                  value={form.status}
                  options={PAGE_STATUS_OPTIONS}
                  onChangeAction={(value) => setField("status", value as PageFormValues["status"])}
                />
              </Field>

              <Field label="Slug" htmlFor="page-slug" hint="Auto-generated from title until you edit it." span={8}>
                <Input
                  id="page-slug"
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

              <Field label="Layout" htmlFor="page-type" hint="Template behavior is not available yet." span={4}>
                <PageTypeField id="page-type" value={form.type} onChange={(v) => setField("type", v)} />
              </Field>
            </FormGrid12>
          </Section>

          {form.type === "LISTING" && (
            <Section title="Listing configuration" desc="Listing configuration is not available yet.">
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
            <Section title="Event details" desc="Event details cannot be edited yet.">
              <fieldset disabled>
                <EventFields values={form} onChangeAction={(key, value) => setField(key, value)} />
              </fieldset>
            </Section>
          )}

          {form.type === "REDIRECT" && (
            <Section title="Redirect" desc="Redirect targets cannot be edited yet.">
              <fieldset disabled>
                <RedirectField value={form.redirectTo} onChangeAction={(value) => setField("redirectTo", value)} />
              </fieldset>
            </Section>
          )}

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
