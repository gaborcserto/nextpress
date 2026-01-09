"use client";

import { usePostEditor } from "./PostEditorScreen.hooks";
import type { PostEditorScreenProps } from "./PostEditorScreen.types";
import { loadTagOptionsAction, createTagAction } from "@/lib/services/tag.client";
import { PostForm } from "@/ui/shell";

export default function PostEditorScreen({ postId }: PostEditorScreenProps) {
  const {
    isEdit,
    item,
    isLoading,
    notFound,
    saving,
    handleSubmit,
  } = usePostEditor(postId);

  const title = isEdit ? "Edit Post" : "Create Post";
  const subtitle = isEdit
    ? "Update the content and metadata of this post."
    : "Publish a new post on your site.";
  const submitLabel = isEdit ? "Save changes" : "Create";

  if (isEdit && isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2">
          <span className="loading loading-spinner" />
          <span>Loading post…</span>
        </div>
      </div>
    );
  }

  if (isEdit && notFound) {
    return (
      <div className="p-6">
        <div className="py-10 text-center text-base-content/70">
          Post not found.
        </div>
      </div>
    );
  }

  if (!item) return null;

  return (
    <div className="py-6 px-3 w-full space-y-6">
      <PostForm
        initial={item}
        submitting={saving}
        submitLabel={submitLabel}
        onSubmitAction={handleSubmit}
        loadTagOptionsAction={loadTagOptionsAction}
        createTagAction={createTagAction}
        sidebarTitle={title}
        sidebarSubtitle={subtitle}
        // imageUploadAction
      />
    </div>
  );
}
