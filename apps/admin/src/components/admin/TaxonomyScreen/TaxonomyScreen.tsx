"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FaPlus, FaTrash } from "react-icons/fa";

import type { TagUsageRow } from "./TaxonomyScreen.types";
import {
  createTagAction,
  deleteTagAdminAction,
  loadTagsAdminAction,
} from "@/lib/services/tag.client";
import { slugify } from "@/lib/utils";
import { DataListEmptyRow, DataListLoading, DataListSurface } from "@/ui/components/DataList";
import {
  Box,
  Button,
  IconButton,
  ConfirmDialog,
  useConfirmDialog,
  FormGrid12,
  Field,
  Input,
  Section,
} from "@/ui/primitives";
import { AdminPageColumns, AdminPageLayout } from "@/ui/shell";
import { showToast } from "@/ui/utils";

type ConfirmPayload = { id: string; name: string; usedCount: number };

export default function TaxonomyScreen() {
  const [items, setItems] = useState<TagUsageRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const slug = slugify(name);

  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deletingRef = useRef(false);
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

  const canCreate = name.trim().length > 0 && slug.trim().length > 0 && !creating;

  const onCreate = async () => {
    if (!canCreate || creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    setError(null);

    try {
      const created = await createTagAction(name.trim());

      setItems((prev) => [
        { id: created.id, name: created.name, slug: created.slug, usedCount: 0 },
        ...prev,
      ]);

      setName("");

      void reload();
      showToast("Tag created.", "success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create tag.");
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  const onAskDelete = (t: TagUsageRow) => {
    confirm.show({ id: t.id, name: t.name, usedCount: t.usedCount });
  };

  const onConfirmDelete = async () => {
    if (!confirm.payload || deletingRef.current) return;
    deletingRef.current = true;

    const { id } = confirm.payload;
    setDeletingId(id);
    setError(null);

    try {
      await deleteTagAdminAction(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
      confirm.hide();
      showToast("Tag deleted.", "success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete tag.");
    } finally {
      deletingRef.current = false;
      setDeletingId(null);
    }
  };

  return (
    <AdminPageLayout title="Taxonomy" description="Manage tags and track usage.">
      <AdminPageColumns sidebar={
        <>
            <Section title="Create tag" desc="Add a new tag.">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void onCreate();
                }}
              >
              <fieldset disabled={creating}>
              <FormGrid12>
                <Field label="Name" htmlFor="tag-name" span={12}>
                  <Input
                    id="tag-name"
                    fullWidth
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </Field>

                <Field label="Slug" htmlFor="tag-slug" hint="Generated from the tag name." span={12}>
                  <Input
                    id="tag-slug"
                    fullWidth
                    value={slug}
                    readOnly
                  />
                </Field>
              </FormGrid12>

              <Box bare className="mt-3 flex justify-end">
                <div className="flex items-center gap-2">
                  {error ? <div role="alert" className="text-sm text-error">{error}</div> : null}

                <IconButton
                  type="submit"
                  icon={FaPlus}
                    color="primary"
                    variant="solid"
                    size="sm"
                    loading={creating}
                    disabled={!canCreate}
                  aria-label="Create tag"
                  >
                    Create
                  </IconButton>
                </div>
              </Box>
              </fieldset>
              </form>
            </Section>
        </>
      }>

            <Section title="Tags" desc="Used = number of pages/posts linked to the tag.">
              {loading ? (
                <DataListLoading label="tags" />
              ) : (
                <DataListSurface>
                  <table className="table min-w-[520px] table-zebra w-full">
                    <thead className="bg-base-200">
                    <tr>
                      <th>Name</th>
                      <th>Slug</th>
                      <th className="text-right">Used</th>
                      <th className="whitespace-nowrap text-right">Actions</th>
                    </tr>
                    </thead>

                    <tbody>
                    {sorted.length ? (
                      sorted.map((t) => (
                        <tr key={t.id}>
                          <td className="font-medium">{t.name}</td>
                          <td className="opacity-80">{t.slug}</td>
                          <td className="text-right tabular-nums font-medium"><div className="badge badge-soft badge-primary">{t.usedCount}</div></td>
                          <td className="whitespace-nowrap text-right">
                            <IconButton
                              icon={FaTrash}
                              size="sm"
                              color="error"
                              variant="solid"
                              loading={deletingId === t.id}
                              disabled={Boolean(deletingId)}
                              aria-label={`Delete tag ${t.name}`}
                              onClick={() => onAskDelete(t)}
                            >
                              Delete
                            </IconButton>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <DataListEmptyRow colSpan={4}>No tags found.</DataListEmptyRow>
                    )}
                    </tbody>
                  </table>
                </DataListSurface>
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
      </AdminPageColumns>

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
    </AdminPageLayout>
  );
}
