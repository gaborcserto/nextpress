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
import { TagMultiSelect } from "@/ui/components/TagMultiSelect";
import Section from "@/ui/layout/Section";

export default function PageForm({
  initial,
  onSubmitAction,
  submitting = false,
  submitLabel = "Save",
  loadTagOptionsAction,
  createTagAction,
}: PageFormProps) {
  // init state
  const [form, setForm] = useState<PageFormValues>(() => {
    if (!initial.slug && initial.title) {
      return { ...initial, slug: slugify(initial.title) };
    }
    return initial;
  });

  const [slugEdited, setSlugEdited] = useState<boolean>(Boolean(initial.slug));

  const setField = <K extends keyof PageFormValues>(
    key: K,
    value: PageFormValues[K]
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
    value: PageFormValues["listingKind"] | PageFormValues["listingTaxonomyId"]
  ) => {
    if (key === "listingKind") {
      setField("listingKind", value as PageFormValues["listingKind"]);
    } else {
      setField(
        "listingTaxonomyId",
        value as PageFormValues["listingTaxonomyId"]
      );
    }
  };

  const handleSubmit = () => {
    onSubmitAction(form);
  };

  return (
    <div className="space-y-6">
      {/* BASIC INFO SECTION */}
      <Section
        title="Basic info"
        desc="Set title, status, slug and page type."
      >
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
              onChange={(e) =>
                setField("status", e.target.value as PageFormValues["status"])
              }
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </select>
          </Field>

          {/* SLUG */}
          <Field
            label="Slug"
            hint="Auto-generated from title until you edit it."
            span={8}
          >
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
            <PageTypeField
              value={form.type}
              onChange={(v) => setField("type", v)}
            />
          </Field>

          {/* EXCERPT */}
          <Field label="Excerpt" span={12}>
            <input
              className="input input-bordered w-full"
              value={form.excerpt}
              onChange={(e) => setField("excerpt", e.target.value)}
            />
          </Field>
        </FormGrid12>
      </Section>

      {/* DYNAMIC FIELDS BASED ON PAGE TYPE */}
      {form.type === "LISTING" && (
        <Section
          title="Listing configuration"
          desc="Choose what type of content should be listed."
        >
          <ListingFields
            listingKind={form.listingKind}
            listingTaxonomyId={form.listingTaxonomyId}
            onChangeAction={handleListingChange}
          />
        </Section>
      )}

      {form.type === "EVENT_PAGE" && (
        <Section
          title="Event details"
          desc="Start, end, location, registration."
        >
          <EventFields
            values={form}
            onChangeAction={(key, value) => setField(key, value)}
          />
        </Section>
      )}

      {form.type === "REDIRECT" && (
        <Section title="Redirect" desc="Visitors will be redirected.">
          <RedirectField
            value={form.redirectTo}
            onChangeAction={(value) => setField("redirectTo", value)}
          />
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

      {/* HIERARCHY (PARENT PAGE) */}
      <Section title="Hierarchy" desc="Optional parent page selection.">
        <HierarchyField
          parentId={form.parentId}
          onChangeAction={(value) => setField("parentId", value)}
        />
      </Section>

      {/* MENU PLACEMENT */}
      <Section title="Menu placement" desc="Where should this page appear?">
        <MenuPlacementField
          inHeader={form.inHeaderMenu}
          inFooter={form.inFooterMenu}
          onChangeAction={(key, value) => setField(key, value)}
        />
      </Section>

      {/* TAGS */}
      <Section title="Tags" desc="Categorize page with tags.">
        <TagMultiSelect
          value={form.tags}
          onChangeAction={(tags) => setField("tags", tags)}
          loadOptionsAction={loadTagOptionsAction}
          createTagAction={createTagAction}
        />
      </Section>

      {/* ACTION BUTTONS */}
      <StickyWrapper>
        <Button variant="ghost" color="neutral" onClick={() => history.back()}>
          Cancel
        </Button>
        <Button
          color="primary"
          className="min-w-[7.5rem]"
          loading={submitting}
          onClick={handleSubmit}
        >
          {submitLabel}
        </Button>
      </StickyWrapper>
    </div>
  );
}
