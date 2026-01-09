"use client";

import { useEffect, useMemo, useState } from "react";
import { FaPlus, FaTrash } from "react-icons/fa";

import type { TagUsageRow } from "./TaxonomyScreen.types";
import {
  createTagAction,
  deleteTagAdminAction,
  loadTagsAdminAction,
} from "@/lib/services/tag.client";
import { slugify } from "@/lib/utils";
import Box from "@/ui/components/Box";
import { Button, IconButton } from "@/ui/components/Buttons";
import { ConfirmDialog, useConfirmDialog } from "@/ui/components/ConfirmDialog";
import { FormGrid12, Field } from "@/ui/components/FormGrid";
import Input from "@/ui/components/Input";
import Section from "@/ui/layout/Section";


type ConfirmPayload = { id: string; name: string; usedCount: number };

export default function TaxonomyScreen() {
  const [items, setItems] = useState<TagUsageRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirm = useConfirmDialog<ConfirmPayload>();

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => b.usedCount - a.usedCount);
  }, [items]);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadTagsAdminAction();
      setItems(
        data.map((t) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          usedCount: t.usedCount,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tags.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    if (!slugEdited) setSlug(slugify(name));
  }, [name, slugEdited]);

  const canCreate = name.trim().length > 0 && slug.trim().length > 0 && !creating;

  const onCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    setError(null);

    try {
      const created = await createTagAction(name.trim());

      setItems((prev) => [
        { id: created.id, name: created.name, slug: created.slug, usedCount: 0 },
        ...prev,
      ]);

      setName("");
      setSlug("");
      setSlugEdited(false);

      void reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create tag.");
    } finally {
      setCreating(false);
    }
  };

  const onAskDelete = (t: TagUsageRow) => {
    confirm.show({ id: t.id, name: t.name, usedCount: t.usedCount });
  };

  const onConfirmDelete = async () => {
    if (!confirm.payload) return;

    const { id } = confirm.payload;
    setDeletingId(id);
    setError(null);

    try {
      await deleteTagAdminAction(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
      confirm.hide();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete tag.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6 w-full space-y-6">
      <div className="space-y-6 w-full">
        <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-6 self-start">
            <header className="h-20 flex flex-col justify-center space-y-1">
              <h1 className="text-2xl font-semibold">Taxonomy</h1>
              <p className="text-base-content/70">Manage tags and track usage.</p>
            </header>

            <Section title="Create tag" desc="Add a new tag.">
              <FormGrid12>
                <Field label="Name" span={12}>
                  <Input
                    fullWidth
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </Field>

                <Field label="Slug" hint="Auto-generates from name until you edit it." span={12}>
                  <Input
                    fullWidth
                    value={slug}
                    onChange={(e) => {
                      setSlugEdited(true);
                      setSlug(slugify(e.target.value));
                    }}
                    required
                  />
                </Field>
              </FormGrid12>

              <Box bare className="mt-3 flex justify-end">
                <div className="flex items-center gap-2">
                  {error ? <div className="text-sm text-error">{error}</div> : null}

                  <IconButton
                    icon={FaPlus}
                    color="primary"
                    variant="solid"
                    size="sm"
                    loading={creating}
                    disabled={!canCreate}
                    onClick={onCreate}
                    aria-label="Create tag"
                  >
                    Create
                  </IconButton>
                </div>
              </Box>
            </Section>
          </aside>

          <main className="lg:col-span-8 space-y-6 min-w-0 lg:pt-26">
            <Section title="Tags" desc="Used = number of pages/posts linked to the tag.">
              {loading ? (
                <div className="flex items-center gap-2">
                  <span className="loading loading-spinner" />
                  <span>Loading…</span>
                </div>
              ) : (
                <div className="overflow-x-auto w-full bg-base-100 rounded-lg shadow border border-base-300">
                  <table className="table table-zebra w-full">
                    <thead className="bg-base-200">
                    <tr>
                      <th>Name</th>
                      <th>Slug</th>
                      <th className="text-right">Used</th>
                      <th className="text-right">Actions</th>
                    </tr>
                    </thead>

                    <tbody>
                    {sorted.length ? (
                      sorted.map((t) => (
                        <tr key={t.id}>
                          <td className="font-medium">{t.name}</td>
                          <td className="opacity-80">{t.slug}</td>
                          <td className="text-right tabular-nums font-medium"><div className="badge badge-soft badge-primary">{t.usedCount}</div></td>
                          <td className="text-right">
                            <IconButton
                              icon={FaTrash}
                              size="sm"
                              color="error"
                              loading={deletingId === t.id}
                              aria-label={`Delete tag ${t.name}`}
                              onClick={() => onAskDelete(t)}
                            >
                              Delete
                            </IconButton>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="text-center py-6 opacity-50">
                          No tags found.
                        </td>
                      </tr>
                    )}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <div className="flex justify-end">
              <Button
                variant="ghost"
                color="neutral"
                onClick={() => void reload()}
              >
                Refresh
              </Button>
            </div>
          </main>
        </div>

        <ConfirmDialog
          open={confirm.open}
          title="Delete tag?"
          confirmLabel="Delete"
          confirmColor="error"
          loading={!!deletingId && deletingId === confirm.payload?.id}
          onCancelAction={confirm.hide}
          onConfirmAction={onConfirmDelete}
        >
          {confirm.payload ? (
            <>
              <p>
                You are about to delete <span className="font-medium">{confirm.payload.name}</span>.
              </p>
              <p className="mt-2">
                This tag is used by{" "}
                <span className="font-semibold tabular-nums">{confirm.payload.usedCount}</span>{" "}
                page(s)/post(s). Deleting it will remove the tag from all of them.
              </p>
            </>
          ) : null}
        </ConfirmDialog>
      </div>
    </div>
  );
}
