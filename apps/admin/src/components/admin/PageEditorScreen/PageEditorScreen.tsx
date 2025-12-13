"use client";

import { usePageEditor } from "./PageEditorScreen.hooks";
import type { PageEditorScreenProps } from "./PageEditorScreen.types";
import { loadTagOptionsAction, createTagAction } from "@/lib/services/tag.client";
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

  if (isEdit && isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2">
          <span className="loading loading-spinner" />
          <span>Loading page…</span>
        </div>
      </div>
    );
  }

  if (isEdit && (notFound || !item)) {
    return (
      <div className="p-6">
        <div className="py-10 text-center text-base-content/70">
          Page not found.
        </div>
      </div>
    );
  }

  if (!item) return null;

  return (
    <div className="p-6 w-full space-y-6">
      <PageForm
        initial={item}
        submitting={saving}
        submitLabel={submitLabel}
        onSubmitAction={handleSubmit}
        loadTagOptionsAction={loadTagOptionsAction}
        createTagAction={createTagAction}
        sidebarTitle={title}
        sidebarSubtitle={subtitle}
      />
    </div>
  );
}
