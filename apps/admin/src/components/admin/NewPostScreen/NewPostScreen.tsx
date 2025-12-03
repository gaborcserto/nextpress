"use client";

import { useCreatePost } from "./NewPostScreen.hooks";
import { loadTagOptionsAction, createTagAction } from "@/lib/services/tag.client";
import PostForm from "@/ui/layout/PostForm";
import type { PostFormValues } from "@/ui/layout/PostForm/PostForm.types";

/**
 * Page for creating a new blog post.
 * Uses the shared PostForm component with a wide layout.
 */
export default function NewPostScreen() {
  const { saving, createPost } = useCreatePost();

  const initial: PostFormValues = {
    status: "DRAFT",
    slug: "",
    title: "",
    excerpt: "",
    content: "",
    tags: [],
    cover: null,
    publishedAt: null,
  };

  const handleSubmit = (values: PostFormValues) => {
    return createPost(values);
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Page header */}
        <header>
          <h1 className="text-2xl font-semibold mb-1">Create Post</h1>
          <p className="text-base-content/70">
            Publish a new post on your site.
          </p>
        </header>

        {/* Main form section */}
        <PostForm
          initial={initial}
          submitting={saving}
          submitLabel="Create"
          onSubmitAction={handleSubmit}
          loadTagOptionsAction={loadTagOptionsAction}
          createTagAction={createTagAction}
          // imageUploadAction can be added later
        />
      </div>
    </div>
  );
}
