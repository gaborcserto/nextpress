"use client";

import { usePageEditor } from "./PageEditorScreen.hooks";
import type { PageEditorScreenProps } from "./PageEditorScreen.types";
import { ApiRequestError } from "@/lib/api/client";
import {
  createTagAction,
  loadEntityTagsAction,
  loadTagOptionsAction,
  updateEntityTagsAction,
} from "@/lib/services/tag.client";
import { Alert } from "@/ui/primitives";
import { AdminPageLayout, PageForm } from "@/ui/shell";

export default function PageEditorScreen({ id }: PageEditorScreenProps) {
  const {
    isEdit,
    item,
    isLoading,
    notFound,
    error,
    saving,
    handleSubmit,
  } = usePageEditor(id);

  const title = isEdit ? "Edit Page" : "Create Page";
  const subtitle = isEdit
    ? "Update your page details."
    : "Add a new page to your site.";
  const submitLabel = isEdit ? "Save" : "Create";

  if (error && !(error instanceof ApiRequestError && error.status === 404)) {
    return (
      <AdminPageLayout title={title} description={subtitle}>
        <Alert status="error" message="Unable to load page. Please try again." />
      </AdminPageLayout>
    );
  }

  if (isEdit && isLoading) {
    return (
      <AdminPageLayout title={title} description={subtitle}>
        <div className="flex items-center gap-2" role="status">
          <span className="loading loading-spinner" />
          <span>Loading page…</span>
        </div>
      </AdminPageLayout>
    );
  }

  if (isEdit && (notFound || !item)) {
    return (
      <AdminPageLayout title={title} description={subtitle}>
        <div className="py-10 text-center text-base-content/70">
          Page not found.
        </div>
      </AdminPageLayout>
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
