"use client";

import { useState } from "react";

import type { PageFormProps, PageFormValues } from "./PageForm.types";
import { slugify } from "@/lib/utils";
import { Button } from "@/ui/components/Buttons";
import EventFields from "@/ui/components/EventFields";
import { FormGrid12, Field } from "@/ui/components/FormGrid";
import HierarchyField from "@/ui/components/HierarchyField";
import ListingFields from "@/ui/components/ListingFields";
import MenuPlacementField from "@/ui/components/MenuPlacementField";
import PageTypeField from "@/ui/components/PageTypeField";
import RedirectField from "@/ui/components/RedirectField";
import StickyWrapper from "@/ui/components/StickyWrapper";
import TagsField from "@/ui/components/TagsField/TagsField";
import Section from "@/ui/layout/Section";
import { buildInitialForm, getEntityId } from "@/ui/utils/editorForm";

export default function PageForm({
  initial,
  onSubmitAction,
  submitting = false,
  submitLabel = "Save",
  sidebarTitle,
  sidebarSubtitle,
}: PageFormProps) {
  // init state
  const [form, setForm] = useState<PageFormValues>(() => buildInitialForm(initial));

  const [slugEdited, setSlugEdited] = useState<boolean>(Boolean(initial.slug));

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
          <Section title="Tags" desc="Categorize page with tags.">
            <TagsField
              entityId={entityId}
              value={form.tags}
              onChangeAction={(tags) => setField("tags", tags)}
              persist={Boolean(entityId)}
            />
          </Section>

          {/* HIERARCHY (PARENT PAGE) */}
          <Section title="Hierarchy" desc="Optional parent page selection.">
            <HierarchyField parentId={form.parentId} onChangeAction={(value) => setField("parentId", value)} />
          </Section>

          {/* MENU PLACEMENT */}
          <Section title="Menu placement" desc="Where should this page appear?">
            <MenuPlacementField
              inHeader={form.inHeaderMenu}
              inFooter={form.inFooterMenu}
              onChangeAction={(key, value) => setField(key, value)}
            />
          </Section>
        </aside>

        {/* MAIN CONTENT */}
        <main className="lg:col-span-8 space-y-6 min-w-0 lg:pt-26">
          {/* BASIC INFO SECTION */}
          <Section title="Basic info" desc="Set title, status, slug and page type.">
            <FormGrid12>
              {/* TITLE */}
              <Field label="Title" span={8}>
                <input
                  className="input input-bordered w-full"
                  value={form.title}
                  onChange={(e) => onTitleChange(e.target.value)}
                  required
                />
              </Field>

              {/* STATUS */}
              <Field label="Status" span={4}>
                <select
                  className="select select-bordered w-full"
                  value={form.status}
                  onChange={(e) => setField("status", e.target.value as PageFormValues["status"])}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                </select>
              </Field>

              {/* SLUG */}
              <Field label="Slug" hint="Auto-generated from title until you edit it." span={8}>
                <input
                  className="input input-bordered w-full"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugEdited(true);
                    setField("slug", slugify(e.target.value));
                  }}
                  required
                />
              </Field>

              {/* PAGE TYPE SELECT */}
              <Field label="Page Type" span={4}>
                <PageTypeField value={form.type} onChange={(v) => setField("type", v)} />
              </Field>
            </FormGrid12>
          </Section>

          {/* DYNAMIC FIELDS BASED ON PAGE TYPE */}
          {form.type === "LISTING" && (
            <Section title="Listing configuration" desc="Choose what type of content should be listed.">
              <ListingFields
                listingKind={form.listingKind}
                listingTaxonomyId={form.listingTaxonomyId}
                onChangeAction={handleListingChange}
              />
            </Section>
          )}

          {form.type === "EVENT_PAGE" && (
            <Section title="Event details" desc="Start, end, location, registration.">
              <EventFields values={form} onChangeAction={(key, value) => setField(key, value)} />
            </Section>
          )}

          {form.type === "REDIRECT" && (
            <Section title="Redirect" desc="Visitors will be redirected.">
              <RedirectField value={form.redirectTo} onChangeAction={(value) => setField("redirectTo", value)} />
            </Section>
          )}

          {/* CONTENT AREA */}
          <Section title="Content" desc="Write or paste HTML / text content.">
            <textarea
              rows={14}
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
