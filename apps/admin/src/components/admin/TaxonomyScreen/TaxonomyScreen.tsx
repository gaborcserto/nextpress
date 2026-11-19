"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FaPlus, FaSyncAlt, FaTrash } from "react-icons/fa";

import { ApiRequestError } from "@/lib/api/client";
import {
  createTagAction,
  deleteTagAdminAction,
  loadTagsAdminAction,
} from "@/lib/services/tag.client";
import { slugify } from "@/lib/utils";
import {
  DataListEmptyRow,
  DataListLoading,
  DataListSurface,
} from "@/ui/components/DataList";
import {
  SortableHeader,
  useTableSort,
} from "@/ui/components/DataList/SortableHeader";
import { useModalDialog } from "@/ui/hooks/useModalDialog";
import {
  Button,
  IconButton,
  ConfirmDialog,
  useConfirmDialog,
  FormGrid12,
  Field,
  Input,
} from "@/ui/primitives";
import { AdminPageLayout } from "@/ui/shell";
import { showToast } from "@/ui/utils";

import type { TagUsageRow } from "./TaxonomyScreen.types";

type ConfirmPayload = { id: string; name: string; usedCount: number };

export default function TaxonomyScreen() {
  const [items, setItems] = useState<TagUsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const createDialogRef = useModalDialog(createOpen);
  const [name, setName] = useState("");
  const slug = slugify(name);

  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirm = useConfirmDialog<ConfirmPayload>();

  const sort = useTableSort<"name" | "slug" | "posts">("posts", "descending");
  const sorted = sort.sortRows(items, {
    name: (tag) => tag.name,
    slug: (tag) => tag.slug,
    posts: (tag) => tag.usedCount,
  });

  const loadRequest = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    loadRequest.current?.abort();
    const controller = new AbortController();
    loadRequest.current = controller;

    return loadTagsAdminAction(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setItems(
            data.map(({ id, name, slug, usedCount }) => ({
              id,
              name,
              slug,
              usedCount,
            })),
          );
        }
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setLoadError(
            caught instanceof ApiRequestError &&
              (caught.status === 401 || caught.status === 403)
              ? "Unable to access tags. Sign in with an authorized admin account and try again."
              : "Unable to load tags. Please try again.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
  }, []);

  const reload = () => {
    setLoading(true);
    setLoadError(null);
    void load();
  };

  useEffect(() => {
    void load();

    return () => loadRequest.current?.abort();
  }, [load]);

  const canCreate =
    name.trim().length > 0 && slug.trim().length > 0 && !creating;

  const onCreate = async () => {
    if (!canCreate || creatingRef.current) {
      return;
    }

    creatingRef.current = true;
    setCreating(true);
    setError(null);

    try {
      const created = await createTagAction(name.trim());

      setItems((prev) => [
        {
          id: created.id,
          name: created.name,
          slug: created.slug,
          usedCount: 0,
        },
        ...prev,
      ]);

      setName("");
      setCreateOpen(false);
      reload();
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

  const onConfirmDelete = () => {
    void confirm.run(async ({ id }) => {
      setDeletingId(id);

      try {
        await deleteTagAdminAction(id);
        setItems((prev) => prev.filter((item) => item.id !== id));
        showToast("Tag deleted.", "success");
      } catch {
        throw new Error("Unable to delete tag. Please try again.");
      } finally {
        setDeletingId(null);
      }
    });
  };

  function closeCreateDialog() {
    if (!creatingRef.current) {
      setCreateOpen(false);
      setName("");
      setError(null);
    }
  }

  return (
    <AdminPageLayout
      title="Taxonomy"
      description="Manage tags and see how many posts use each one. Sorting applies to the loaded tags."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={reload} disabled={loading}>
            <FaSyncAlt aria-hidden="true" />
            Refresh
          </Button>
          <IconButton
            aria-label="Create tag"
            icon={FaPlus}
            color="primary"
            onClick={() => setCreateOpen(true)}
          >
            Create tag
          </IconButton>
        </div>
      }
    >
      {loading ? (
        <DataListLoading label="tags" />
      ) : loadError ? (
        <div role="alert" className="text-sm text-error">
          {loadError}
        </div>
      ) : (
        <DataListSurface>
          <table
            className="table admin-responsive-table"
            role="table"
            aria-label="Tags"
          >
            <thead role="rowgroup">
              <tr role="row">
                <SortableHeader column="name" sort={sort}>
                  Name
                </SortableHeader>
                <SortableHeader column="slug" sort={sort}>
                  Slug
                </SortableHeader>
                <SortableHeader column="posts" sort={sort}>
                  Posts
                </SortableHeader>
                <th role="columnheader" scope="col" className="text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {sorted.length ? (
                sorted.map((tag) => (
                  <tr key={tag.id} role="row">
                    <td
                      role="cell"
                      className="admin-table-identity font-semibold"
                    >
                      {tag.name}
                    </td>
                    <td role="cell">
                      <span aria-hidden="true" className="admin-cell-label">
                        Slug
                      </span>
                      {tag.slug}
                    </td>
                    <td role="cell" className="tabular-nums">
                      <span aria-hidden="true" className="admin-cell-label">
                        Posts
                      </span>
                      {tag.usedCount}
                    </td>
                    <td role="cell" className="admin-table-actions">
                      <div className="flex justify-end">
                        <IconButton
                          icon={FaTrash}
                          size="sm"
                          color="error"
                          variant="soft"
                          loading={deletingId === tag.id}
                          disabled={Boolean(deletingId)}
                          aria-label={`Delete tag ${tag.name}`}
                          onClick={() => onAskDelete(tag)}
                        >
                          Delete
                        </IconButton>
                      </div>
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

      <dialog
        ref={createDialogRef}
        className="admin-dialog"
        aria-labelledby="create-tag-title"
        onCancel={(event) => {
          event.preventDefault();
          closeCreateDialog();
        }}
      >
        <h2 id="create-tag-title" className="mb-4 text-lg font-semibold">
          Create tag
        </h2>
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
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </Field>
              <Field
                label="Slug"
                htmlFor="tag-slug"
                hint="Generated from the tag name."
                span={12}
              >
                <Input id="tag-slug" fullWidth value={slug} readOnly />
              </Field>
            </FormGrid12>
            {error && (
              <p role="alert" className="mt-3 text-sm text-error">
                {error}
              </p>
            )}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={closeCreateDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                color="primary"
                disabled={!canCreate}
                loading={creating}
              >
                Create tag
              </Button>
            </div>
          </fieldset>
        </form>
      </dialog>

      <ConfirmDialog
        open={confirm.open}
        error={confirm.error}
        title="Delete tag?"
        confirmLabel="Delete"
        confirmColor="error"
        loading={confirm.pending}
        onCancelAction={confirm.hide}
        onConfirmAction={onConfirmDelete}
      >
        {confirm.payload ? (
          <>
            <p>
              You are about to delete{" "}
              <span className="font-medium">{confirm.payload.name}</span>.
            </p>
            <p className="mt-2">
              This tag is used by{" "}
              <span className="font-semibold tabular-nums">
                {confirm.payload.usedCount}
              </span>{" "}
              post(s). Deleting it will remove the tag from all linked pages and
              posts.
            </p>
          </>
        ) : null}
      </ConfirmDialog>
    </AdminPageLayout>
  );
}
