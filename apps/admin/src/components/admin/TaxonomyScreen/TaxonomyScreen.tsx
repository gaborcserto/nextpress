"use client";

import { TaxonomyListSchema } from "@nextpress/shared/api-contracts";
import { useRef, useState } from "react";
import { FaPlus, FaSyncAlt, FaTrash } from "react-icons/fa";

import { ApiRequestError, jsonFetcher } from "@/lib/api/client";
import { useContentList } from "@/lib/content/useContentList";
import {
  createTagAction,
  deleteTagAdminAction,
} from "@/lib/services/tag.client";
import { slugify } from "@/lib/utils";
import ContentListPagination from "@/ui/components/ContentList/ContentListPagination";
import {
  DataListEmptyRow,
  DataListLoading,
  DataListSurface,
} from "@/ui/components/DataList";
import ListFilters, {
  sortDirectionField,
} from "@/ui/components/DataList/ListFilters";
import RecordId from "@/ui/components/DataList/RecordId";
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

type ConfirmPayload = { id: string; name: string; usedCount: number };

const fields = [
  {
    name: "type",
    label: "Taxonomy",
    options: [
      { value: "TAG", label: "Tags" },
      { value: "CATEGORY", label: "Categories" },
    ],
  },
  { name: "q", label: "Search", placeholder: "Name or slug" },
  {
    name: "sort",
    label: "Sort by",
    options: [
      { value: "name", label: "Name" },
      { value: "slug", label: "Slug" },
      { value: "usedCount", label: "Post count" },
    ],
  },
  sortDirectionField,
];

async function fetchTaxonomyList(url: string) {
  return TaxonomyListSchema.parse(await jsonFetcher<unknown>(url));
}

export default function TaxonomyScreen() {
  const {
    items,
    query,
    pagination,
    mutate,
    isLoading: loading,
    error: loadError,
  } = useContentList(
    "/api/admin/tags",
    fetchTaxonomyList,
    () => false,
    ["type", "q", "sort", "direction"],
    { type: "TAG" },
  );
  const isCategory = query.values.get("type") === "CATEGORY";
  const heading = isCategory ? "Categories" : "Tags";
  const listLabel = heading.toLowerCase();

  const [createOpen, setCreateOpen] = useState(false);
  const createDialogRef = useModalDialog(createOpen);
  const [name, setName] = useState("");
  const slug = slugify(name);

  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirm = useConfirmDialog<ConfirmPayload>();

  const reload = () => void mutate();

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
      await createTagAction(name.trim());

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

  const onAskDelete = (t: ConfirmPayload) => {
    confirm.show({ id: t.id, name: t.name, usedCount: t.usedCount });
  };

  const onConfirmDelete = () => {
    void confirm.run(async ({ id }) => {
      setDeletingId(id);

      try {
        await deleteTagAdminAction(id);
        reload();
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
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={reload} disabled={loading}>
            <FaSyncAlt aria-hidden="true" />
            Refresh
          </Button>
          {!isCategory && (
            <IconButton
              aria-label="Create tag"
              icon={FaPlus}
              color="primary"
              onClick={() => setCreateOpen(true)}
            >
              Create tag
            </IconButton>
          )}
        </div>
      }
    >
      <ListFilters query={query} fields={fields} />
      {loading && !items.length ? (
        <DataListLoading reserveSpace label={listLabel} />
      ) : loadError ? (
        <div role="alert" className="text-sm text-error">
          {loadError instanceof ApiRequestError &&
          (loadError.status === 401 || loadError.status === 403)
            ? "Sign in with an authorized admin account and try again."
            : "Unable to load " + listLabel + ". Please try again."}
        </div>
      ) : (
        <DataListSurface
          reserveSpace
          pendingLabel={loading ? listLabel : undefined}
        >
          <table
            className="table admin-responsive-table"
            role="table"
            aria-label={heading}
          >
            <thead role="rowgroup">
              <tr role="row">
                <th scope="col">Name</th>
                <th scope="col">Slug</th>
                <th scope="col">Posts</th>
                {!isCategory && (
                  <th scope="col" className="text-right">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody role="rowgroup">
              {items.length ? (
                items.map((tag) => (
                  <tr key={tag.id} role="row">
                    <td
                      role="cell"
                      className="admin-table-identity font-semibold"
                    >
                      {tag.name}
                      <RecordId id={tag.id} />
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
                    {!isCategory && (
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
                    )}
                  </tr>
                ))
              ) : (
                <DataListEmptyRow colSpan={isCategory ? 3 : 4}>
                  No {listLabel} found.
                </DataListEmptyRow>
              )}
            </tbody>
          </table>
        </DataListSurface>
      )}

      <ContentListPagination heading={heading} pagination={pagination} />

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
