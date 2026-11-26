"use client";

import { TaxonomyListSchema } from "@nextpress/shared/api-contracts";
import { slugify } from "@nextpress/shared/slugify";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import {
  FaEdit,
  FaFolder,
  FaPlus,
  FaSave,
  FaSyncAlt,
  FaTag,
  FaTimes,
  FaTrash,
} from "react-icons/fa";

import { useContentList } from "@/hooks/useContentList";
import { ApiRequestError, jsonFetcher } from "@/lib/api/client";
import { useAdminLocale } from "@/lib/i18n/admin-locale";
import {
  DataListLoading,
  DataListScrollableResults,
  DataListSurface,
} from "@/ui/components/DataList";
import DataListPagination from "@/ui/components/DataList/DataListPagination";
import ListFilters from "@/ui/components/DataList/ListFilters";
import {
  MobileSortControl,
  QuerySortableHeader,
} from "@/ui/components/DataList/SortableHeader";
import { EmptyState } from "@/ui/components/EmptyState";
import { TruncatedText } from "@/ui/components/TruncatedText/TruncatedText";
import { useModalDialog } from "@/ui/hooks/useModalDialog";
import {
  AdminAsyncButton,
  AdminButton,
  Alert,
  ConfirmDialog,
  useConfirmDialog,
  FormGrid12,
  Field,
  Input,
} from "@/ui/primitives";
import { AdminDialogHeader } from "@/ui/primitives/AdminDialogHeader/AdminDialogHeader";
import { AdminPageLayout } from "@/ui/shell";
import { showToast } from "@/ui/utils";

import {
  createTagAction,
  deleteTagAdminAction,
  updateTagAdminAction,
} from "../tag.client";

type ConfirmPayload = { id: string; name: string; usedCount: number };

const taxonomyTypes = [
  { value: "TAG", label: "Tags" },
  { value: "CATEGORY", label: "Categories" },
] as const;

const fields = [{ name: "q", label: "Search", placeholder: "Name or slug" }];

const emptyMessages = {
  en: {
    category: {
      heading: "No categories yet",
      description: "Create categories to organize your content.",
      noMatches: "No matching categories",
    },
    tag: {
      heading: "No tags yet",
      description: "Create tags to help classify your content.",
      noMatches: "No matching tags",
    },
    searchHint: "Try a different search term.",
  },
  hu: {
    category: {
      heading: "Még nincsenek kategóriák",
      description: "Hozzon létre kategóriákat a tartalmak rendszerezéséhez.",
      noMatches: "Nincs egyező kategória",
    },
    tag: {
      heading: "Még nincsenek címkék",
      description: "Hozzon létre címkéket a tartalmak besorolásához.",
      noMatches: "Nincs egyező címke",
    },
    searchHint: "Próbálkozzon másik keresőkifejezéssel.",
  },
};

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
  const sortColumn = query.values.get("sort") ?? "name";
  const sortDirection = query.values.get("direction") ?? "asc";
  const heading = isCategory ? "Categories" : "Tags";
  const listLabel = heading.toLowerCase();
  const itemLabel = isCategory ? "category" : "tag";
  const createLabel = isCategory ? "Create category" : "Create tag";

  const messages = emptyMessages[useAdminLocale()];
  const empty = messages[itemLabel];
  const searching = Boolean(query.values.get("q")?.trim());

  const [createOpen, setCreateOpen] = useState(false);
  const createDialogRef = useModalDialog(createOpen);
  const [name, setName] = useState("");
  const slug = slugify(name);

  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingTag, setEditingTag] = useState<
    (ConfirmPayload & { slug: string }) | null
  >(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const editDialogRef = useModalDialog(Boolean(editingTag));

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
      if (isCategory) {
        await jsonFetcher("/api/admin/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), slug }),
        });
      } else {
        await createTagAction(name.trim());
      }

      setName("");
      setCreateOpen(false);
      reload();
      showToast(isCategory ? "Category created." : "Tag created.", "success");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : `Failed to create ${itemLabel}.`,
      );
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  const onAskDelete = (t: ConfirmPayload) => {
    confirm.show({ id: t.id, name: t.name, usedCount: t.usedCount });
  };

  async function saveTagEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingTag || !editName.trim() || !editSlug.trim() || savingEdit) {
      return;
    }

    setSavingEdit(true);
    setError(null);

    try {
      await updateTagAdminAction(editingTag.id, {
        name: editName.trim(),
        slug: slugify(editSlug),
      });
      setEditingTag(null);
      reload();
      showToast(isCategory ? "Category updated." : "Tag updated.", "success");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to update tag.",
      );
    } finally {
      setSavingEdit(false);
    }
  }

  const onConfirmDelete = () => {
    void confirm.run(async ({ id }) => {
      setDeletingId(id);

      try {
        await deleteTagAdminAction(id, isCategory ? "CATEGORY" : "TAG");
        reload();
        showToast(isCategory ? "Category deleted." : "Tag deleted.", "success");
      } catch (error) {
        if (
          isCategory &&
          error instanceof ApiRequestError &&
          error.status === 409
        ) {
          throw new Error(
            "Remove content references before deleting this category.",
          );
        }

        throw new Error(`Unable to delete ${itemLabel}. Please try again.`);
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

  function closeEditDialog() {
    if (!savingEdit) {
      setEditingTag(null);
      setError(null);
    }
  }

  return (
    <AdminPageLayout
      title="Taxonomy"
      description="Manage categories and tags used to organize content."
      actions={
        <div className="flex flex-wrap gap-2">
          <AdminButton variant="ghost" onClick={reload} disabled={loading}>
            <FaSyncAlt aria-hidden="true" />
            Refresh
          </AdminButton>
          <AdminButton
            aria-label={createLabel}
            icon={FaPlus}
            color="primary"
            onClick={() => setCreateOpen(true)}
          >
            {createLabel}
          </AdminButton>
        </div>
      }
    >
      <div className="admin-tab-stack">
        <nav className="admin-taxonomy-tabs" aria-label="Taxonomy sections">
          {taxonomyTypes.map(({ value, label }) => {
            const active = label === heading;
            const params = new URLSearchParams(query.values);
            params.set("type", value);
            params.delete("page");

            return (
              <Link
                key={value}
                href={`/admin/taxonomy?${params}`}
                aria-current={active ? "page" : undefined}
                scroll={false}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        {loading && !items.length ? (
          <DataListLoading reserveSpace label={listLabel} />
        ) : loadError ? (
          <Alert
            status="error"
            message={
              loadError instanceof ApiRequestError &&
              (loadError.status === 401 || loadError.status === 403)
                ? "Sign in with an authorized admin account and try again."
                : "Unable to load " + listLabel + ". Please try again."
            }
          />
        ) : (
          <DataListSurface
            reserveSpace
            pendingLabel={loading ? listLabel : undefined}
          >
            <ListFilters query={query} fields={fields} searchWidth="responsive">
              <input
                type="hidden"
                name="type"
                value={isCategory ? "CATEGORY" : "TAG"}
              />
            </ListFilters>
            <MobileSortControl
              label="Sort by"
              directionLabel="Change sort direction"
              options={[
                { value: "name", label: "Name" },
                { value: "slug", label: "Slug" },
                { value: "usedCount", label: "Posts" },
              ]}
              value={sortColumn}
              direction={sortDirection === "desc" ? "desc" : "asc"}
              onFieldAction={query.onSortFieldAction}
              onDirectionAction={() => query.onSortAction(sortColumn)}
            />
            <DataListScrollableResults>
              <table
                className="table admin-responsive-table admin-bounded-table"
                role="table"
                aria-label={heading}
              >
                <thead role="rowgroup">
                  <tr role="row">
                    {(["name", "slug", "usedCount"] as const).map((column) => (
                      <QuerySortableHeader
                        key={column}
                        column={column}
                        activeColumn={sortColumn}
                        direction={sortDirection === "desc" ? "desc" : "asc"}
                        onSortAction={query.onSortAction}
                      >
                        {column === "usedCount"
                          ? "Posts"
                          : column === "name"
                            ? "Name"
                            : "Slug"}
                      </QuerySortableHeader>
                    ))}
                    <th scope="col" className="text-right">
                      Actions
                    </th>
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
                          <TruncatedText value={tag.name} />
                        </td>
                        <td role="cell">
                          <span aria-hidden="true" className="admin-cell-label">
                            Slug
                          </span>
                          <TruncatedText value={tag.slug} />
                        </td>
                        <td role="cell" className="tabular-nums">
                          <span aria-hidden="true" className="admin-cell-label">
                            Posts
                          </span>
                          {tag.usedCount}
                        </td>
                        <td role="cell" className="admin-table-actions">
                          <div className="flex justify-end">
                            <AdminButton
                              icon={FaEdit}
                              size="sm"
                              variant="ghost"
                              aria-label={`Edit ${itemLabel} ${tag.name}`}
                              title={`Edit ${itemLabel} ${tag.name}`}
                              onClick={() => {
                                setEditingTag(tag);
                                setEditName(tag.name);
                                setEditSlug(tag.slug);
                                setError(null);
                              }}
                            >
                              Edit
                            </AdminButton>
                            <AdminAsyncButton
                              icon={FaTrash}
                              size="sm"
                              color="error"
                              variant="ghost"
                              loading={deletingId === tag.id}
                              disabled={Boolean(deletingId)}
                              aria-label={`Delete ${itemLabel} ${tag.name}`}
                              title={`Delete ${itemLabel} ${tag.name}`}
                              onClick={() => onAskDelete(tag)}
                            >
                              Delete
                            </AdminAsyncButton>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr role="row" className="admin-table-empty">
                      <td role="cell" colSpan={4}>
                        <EmptyState
                          variant="plain"
                          icon={isCategory ? FaFolder : FaTag}
                          heading={searching ? empty.noMatches : empty.heading}
                          description={
                            searching ? messages.searchHint : empty.description
                          }
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </DataListScrollableResults>
          </DataListSurface>
        )}
      </div>

      <DataListPagination heading={heading} pagination={pagination} />

      <dialog
        ref={createDialogRef}
        className="admin-dialog taxonomy-dialog"
        aria-labelledby="create-tag-title"
        onCancel={(event) => {
          event.preventDefault();
          closeCreateDialog();
        }}
      >
        <AdminDialogHeader
          title={createLabel}
          titleId="create-tag-title"
          closeLabel="Close dialog"
          disabled={creating}
          onClose={closeCreateDialog}
        />
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
                hint="Generated from the name."
                span={12}
              >
                <Input id="tag-slug" fullWidth value={slug} readOnly />
              </Field>
            </FormGrid12>
            <Alert status="error" message={error} className="mt-3" />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <AdminButton variant="ghost" onClick={closeCreateDialog}>
                <FaTimes aria-hidden="true" />
                Cancel
              </AdminButton>
              <AdminAsyncButton
                type="submit"
                color="primary"
                disabled={!canCreate}
                loading={creating}
                icon={FaSave}
              >
                {createLabel}
              </AdminAsyncButton>
            </div>
          </fieldset>
        </form>
      </dialog>

      <dialog
        ref={editDialogRef}
        className="admin-dialog taxonomy-dialog"
        aria-labelledby="edit-tag-title"
        onCancel={(event) => {
          event.preventDefault();
          closeEditDialog();
        }}
      >
        <AdminDialogHeader
          title={isCategory ? "Edit category" : "Edit tag"}
          titleId="edit-tag-title"
          closeLabel="Close dialog"
          disabled={savingEdit}
          onClose={closeEditDialog}
        />
        <form onSubmit={saveTagEdit}>
          <fieldset disabled={savingEdit}>
            <FormGrid12>
              <Field label="Name" htmlFor="edit-tag-name" span={12}>
                <Input
                  id="edit-tag-name"
                  fullWidth
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  required
                />
              </Field>
              <Field label="Slug" htmlFor="edit-tag-slug" span={12}>
                <Input
                  id="edit-tag-slug"
                  fullWidth
                  value={editSlug}
                  onChange={(event) => setEditSlug(slugify(event.target.value))}
                  required
                />
              </Field>
            </FormGrid12>
            <Alert status="error" message={error} className="mt-3" />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <AdminButton variant="ghost" onClick={closeEditDialog}>
                <FaTimes aria-hidden="true" />
                Cancel
              </AdminButton>
              <AdminAsyncButton
                type="submit"
                color="primary"
                disabled={!editName.trim() || !editSlug.trim()}
                loading={savingEdit}
                icon={FaSave}
              >
                Save changes
              </AdminAsyncButton>
            </div>
          </fieldset>
        </form>
      </dialog>

      <ConfirmDialog
        open={confirm.open}
        error={confirm.error}
        title={isCategory ? "Delete category?" : "Delete tag?"}
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
            {isCategory ? (
              <p className="mt-2">
                Categories referenced by content or revisions cannot be deleted.
              </p>
            ) : (
              <p className="mt-2">
                This tag is used by{" "}
                <span className="font-semibold tabular-nums">
                  {confirm.payload.usedCount}
                </span>{" "}
                post(s). Deleting it will remove the tag from all linked pages
                and posts.
              </p>
            )}
          </>
        ) : null}
      </ConfirmDialog>
    </AdminPageLayout>
  );
}
