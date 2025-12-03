"use client";

import { useState } from "react";

import { useEditPage, updatePage } from "./EditPageScreen.hooks";
import type { EditPageScreenProps } from "./EditPageScreen.types";
import { loadTagOptionsAction, createTagAction } from "@/lib/services/tag.client";
import Box from "@/ui/components/Box/Box";
import PageForm, { type PageFormValues } from "@/ui/layout/PageForm";

export default function EditPageScreen({ id }: EditPageScreenProps) {
  const { item, isLoading, notFound, mutate } = useEditPage(id);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (values: PageFormValues) => {
    setSaving(true);
    try {
      const ok = await updatePage(id, values);
      if (!ok) return;

      await mutate();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold mb-1">Edit Page</h1>
        <p className="text-base-content/70">Update your page details.</p>
      </header>

      <Box bare>
        {isLoading ? (
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
            submitLabel="Save"
            onSubmitAction={handleSubmit}
            loadTagOptionsAction={loadTagOptionsAction}
            createTagAction={createTagAction}
          />
        )}
      </Box>
    </div>
  );
}
