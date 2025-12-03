"use client";

import { useCreatePage } from "./NewPageScreen.hooks";
import { loadTagOptionsAction, createTagAction } from "@/lib/services/tag.client";
import PageForm, { type PageFormValues } from "@/ui/layout/PageForm";

/**
 * Page for creating a new CMS page entry.
 * Uses the shared PageForm component with full-width layout (no card wrapper).
 */
export default function NewPageScreen() {
  const { saving, createPage } = useCreatePage();

  const initial: PageFormValues = {
    type: "STANDARD",
    status: "DRAFT",
    slug: "",
    title: "",
    excerpt: "",
    content: "",
    tags: [],
    parentId: null,
    inHeaderMenu: false,
    inFooterMenu: false,
  };

  const handleSubmit = (values: PageFormValues) => {
    return createPage(values);
  };
  

  return (
      <div className="p-6">
        {/* Centered, wide content container */}
        <div className="max-w-6xl mx-auto space-y-4">
          {/* Page header */}
          <header>
            <h1 className="text-2xl font-semibold mb-1">Create Page</h1>
            <p className="text-base-content/70">Add a new page to your site.</p>
          </header>

          {/* Main form section — no Card wrapper for a full-width layout */}
          <PageForm
              initial={initial}
              submitting={saving}
              submitLabel="Create"
              onSubmitAction={handleSubmit}
              loadTagOptionsAction={loadTagOptionsAction}
              createTagAction={createTagAction}
          />
        </div>
      </div>
  );
}
