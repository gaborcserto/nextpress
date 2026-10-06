"use client";

import { usePostEditor } from "./PostEditorScreen.hooks";
import type { PostEditorScreenProps } from "./PostEditorScreen.types";
import { ApiRequestError } from "@/lib/api/client";
import {
  createTagAction,
  loadEntityTagsAction,
  loadTagOptionsAction,
  updateEntityTagsAction,
} from "@/lib/services/tag.client";
import { Alert } from "@/ui/primitives";
import { AdminPageLayout, PostForm } from "@/ui/shell";

export default function PostEditorScreen({ postId }: PostEditorScreenProps) {
  const {
    isEdit,
    item,
    isLoading,
    notFound,
    error,
    saving,
    handleSubmit,
  } = usePostEditor(postId);

  const title = isEdit ? "Edit Post" : "Create Post";
  const subtitle = isEdit
    ? "Update the content and metadata of this post."
    : "Publish a new post on your site.";
  const submitLabel = isEdit ? "Save changes" : "Create";

  if (error && !(error instanceof ApiRequestError && error.status === 404)) {
    return (
      <AdminPageLayout title={title} description={subtitle}>
        <Alert status="error" message="Unable to load post. Please try again." />
      </AdminPageLayout>
    );
  }

  if (isEdit && isLoading) {
    return (
      <AdminPageLayout title={title} description={subtitle}>
        <div className="flex items-center gap-2" role="status">
          <span className="loading loading-spinner" />
          <span>Loading post…</span>
        </div>
      </AdminPageLayout>
    );
  }

  if (isEdit && notFound) {
    return (
      <AdminPageLayout title={title} description={subtitle}>
        <div className="py-10 text-center text-base-content/70">
          Post not found.
        </div>
      </AdminPageLayout>
    );
  }

  if (!item) return null;

  return (
    <PostForm
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
        // imageUploadAction
    />
  );
}
