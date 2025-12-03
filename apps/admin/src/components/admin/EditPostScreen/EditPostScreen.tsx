"use client";

import { usePostDetail, useUpdatePost } from "./EditPostScreen.hooks";
import { loadTagOptionsAction, createTagAction } from "@/lib/services/tag.client";
import PostForm from "@/ui/layout/PostForm";
import type { PostFormValues } from "@/ui/layout/PostForm/PostForm.types";

/**
 * Screen for editing an existing blog post.
 *
 * Expects the post id as a prop.
 * In the route file, use:
 *   <EditPostScreen postId={params.id} />
 */
export default function EditPostScreen({ postId }: { postId: string }) {
  const { initial, isLoading } = usePostDetail(postId);
  const { saving, updatePost } = useUpdatePost(postId);

  const handleSubmit = (values: PostFormValues) => {
    return updatePost(values);
  };

  if (isLoading || !initial) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2">
          <span className="loading loading-spinner" />
          <span>Loading post…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Page header */}
        <header>
          <h1 className="text-2xl font-semibold mb-1">Edit Post</h1>
          <p className="text-base-content/70">
            Update the content and metadata of this post.
          </p>
        </header>

        <PostForm
          initial={initial}
          submitting={saving}
          submitLabel="Save changes"
          onSubmitAction={handleSubmit}
          loadTagOptionsAction={loadTagOptionsAction}
          createTagAction={createTagAction}
          // imageUploadAction can be passed once you have media upload API
        />
      </div>
    </div>
  );
}
