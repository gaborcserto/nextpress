"use client";

import { useState } from "react";

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
  Section,
  StickyWrapper,
} from "@/ui/primitives";
import type { PageFormProps, PageFormValues } from "@/ui/shell";
import { buildInitialForm, getEntityId, normalizeSlateValue } from "@/ui/utils";

export default function PageForm({
  initial,
  onSubmitAction,
  submitting = false,
  submitLabel = "Save",
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
      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-6 self-start">
          {(sidebarTitle || sidebarSubtitle) && (
            <header className="h-20 flex flex-col justify-center space-y-1">
              <h1 className="text-2xl font-semibold">{sidebarTitle}</h1>
              <p className="text-base-content/70">{sidebarSubtitle}</p>
            </header>
          )}

          <Section title="Tags" desc="Categorize page with tags.">
            <TagsField
              entityId={entityId}
              value={form.tags}
              onChangeAction={(tags) => setField("tags", tags)}
              persist={Boolean(entityId)}
            />
          </Section>

          <Section title="Hierarchy" desc="Optional parent page selection.">
            <HierarchyField parentId={form.parentId} onChangeAction={(value) => setField("parentId", value)} />
          </Section>

          <Section title="Menu placement" desc="Where should this page appear?">
            <MenuPlacementField
              inHeader={form.inHeaderMenu}
              inFooter={form.inFooterMenu}
              onChangeAction={(key, value) => setField(key, value)}
            />
          </Section>
        </aside>

        <main className="lg:col-span-8 space-y-6 min-w-0 lg:pt-26">
          <Section title="Basic info" desc="Set title, status, slug and page type.">
            <FormGrid12>
              <Field label="Title" span={8}>
                <input
                  className="input input-bordered w-full"
                  value={form.title}
                  onChange={(e) => onTitleChange(e.target.value)}
                  required
                />
              </Field>

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

              <Field label="Page Type" span={4}>
                <PageTypeField value={form.type} onChange={(v) => setField("type", v)} />
              </Field>
            </FormGrid12>
          </Section>

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

          <Section title="Content" desc="Write your content.">
            <SlateEditor value={form.content ?? EMPTY_SLATE_VALUE} onChangeAction={(val) => setField("content", val)} />
          </Section>

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
