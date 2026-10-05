"use client";

import { usePageEditor } from "./PageEditorScreen.hooks";
import type { PageEditorScreenProps } from "./PageEditorScreen.types";
import {
  createTagAction,
  loadEntityTagsAction,
  loadTagOptionsAction,
  updateEntityTagsAction,
} from "@/lib/services/tag.client";
import { PageForm } from "@/ui/shell";

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
      <div className="mx-auto w-full max-w-screen-2xl">
        <div className="flex items-center gap-2">
          <span className="loading loading-spinner" />
          <span>Loading page…</span>
        </div>
      </div>
    );
  }

  if (isEdit && (notFound || !item)) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl">
        <div className="py-10 text-center text-base-content/70">
          Page not found.
        </div>
      </div>
    );
  }

  if (!item) return null;

  return (
    <PageForm
        initial={item}
        submitting={saving}
        submitLabel={submitLabel}
        onSubmitAction={handleSubmit}
        loadTagOptionsAction={loadTagOptionsAction}
        createTagAction={createTagAction}
        loadEntityTagsAction={loadEntityTagsAction}
        updateEntityTagsAction={updateEntityTagsAction}
        sidebarTitle={title}
        sidebarSubtitle={subtitle}
    />
  );
}
