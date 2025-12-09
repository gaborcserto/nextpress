"use client";

import { usePageEditor } from "./PageEditorScreen.hooks";
import type { PageEditorScreenProps } from "./PageEditorScreen.types";
import { loadTagOptionsAction, createTagAction } from "@/lib/services/tag.client";
import Box from "@/ui/components/Box/Box";
import PageForm from "@/ui/layout/PageForm";

export default function PageEditorScreen({ id }: PageEditorScreenProps) {
  const {
    isEdit,
    item,
    isLoading,
    notFound,
    saving,
    handleSubmit,
  } = usePageEditor(id);

  const title = isEdit ? "Edit Page" : "Create Page";
  const subtitle = isEdit
    ? "Update your page details."
    : "Add a new page to your site.";
  const submitLabel = isEdit ? "Save" : "Create";

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold mb-1">{title}</h1>
        <p className="text-base-content/70">{subtitle}</p>
      </header>

      <Box bare>
        {isEdit && isLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-8 w-2/3 bg-base-300 rounded" />
            <div className="h-40 bg-base-300 rounded" />
          </div>
        ) : notFound || !item ? (
          <div className="py-10 text-center text-base-content/70">
            Page not found.
          </div>
        ) : (
          <PageForm
            initial={item}
            submitting={saving}
            submitLabel={submitLabel}
            onSubmitAction={handleSubmit}
            loadTagOptionsAction={loadTagOptionsAction}
            createTagAction={createTagAction}
          />
        )}
      </Box>
    </div>
  );
}
