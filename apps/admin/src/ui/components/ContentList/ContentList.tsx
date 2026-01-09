"use client";

import { FaEdit, FaPlus, FaTrash } from "react-icons/fa";

import type { ContentListProps } from "@/ui/components";
import { IconButton, LinkIconButton, ConfirmDialog, useConfirmDialog } from "@/ui/primitives";

type ConfirmPayload = { id: string; title: string };

/**
 * Reusable admin list view for content items (Pages, Posts, etc.).
 * Renders a DaisyUI table with optional columns.
 *
 * Layout/behavior is loosely inspired by the WordPress admin lists.
 */
export default function ContentList({
  heading,
  createHref,
  createLabel,
  editHrefAction,
  items,
  isLoading = false,
  deletingId,
  onDeleteAction,
  showAuthor = false,
  showCategories = false,
  showTags = false,
}: ContentListProps) {
  // Calculate colspan for the "empty" row based on enabled columns
  const baseCols = 5; // Title, Slug, Status, Date, Actions
  const extraCols =
    Number(showAuthor) + Number(showCategories) + Number(showTags);
  const colSpan = baseCols + extraCols;

  const confirm = useConfirmDialog<ConfirmPayload>();

  const askDelete = (id: string, title: string) => confirm.show({ id, title });

  const confirmDelete = () => {
    if (!confirm.payload || !onDeleteAction) return;
    onDeleteAction(confirm.payload.id);
    confirm.hide();
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">{heading}</h1>
        <LinkIconButton
          href={createHref}
          color="primary"
          icon={FaPlus}
          aria-label={createLabel}
        >
          {createLabel}
        </LinkIconButton>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2">
          <span className="loading loading-spinner" />
          <span>Loading…</span>
        </div>
      )}

      {!isLoading && (
        <div className="overflow-x-auto w-full bg-base-100 rounded-lg shadow border border-base-300">
          <table className="table table-zebra w-full">
            <thead className="bg-base-200">
            <tr>
              <th>Title</th>
              <th>Slug</th>
              {showAuthor && <th>Author</th>}
              {showCategories && <th>Categories</th>}
              {showTags && <th>Tags</th>}
              <th>Status</th>
              <th>Date</th>
              <th className="text-right">Actions</th>
            </tr>
            </thead>

            <tbody>
            {items.length ? (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>{item.slug}</td>

                  {showAuthor && <td>{item.author || "—"}</td>}

                  {showCategories && (
                    <td>{item.categories?.join(", ") || "—"}</td>
                  )}

                  {showTags && <td>{item.tags?.join(", ") || "—"}</td>}

                  <td>
                      <span
                        className={`badge ${
                          item.status === "PUBLISHED"
                            ? "badge-success"
                            : "badge-warning"
                        }`}
                      >
                        {item.status}
                      </span>
                  </td>

                  <td>{item.dateLabel ?? "—"}</td>

                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <LinkIconButton
                        href={editHrefAction(item.id)}
                        size="sm"
                        variant="soft"
                        icon={FaEdit}
                        aria-label={`Edit ${item.title}`}
                      >
                        Edit
                      </LinkIconButton>

                      {onDeleteAction && (
                        <IconButton
                          icon={FaTrash}
                          size="sm"
                          color="error"
                          variant="solid"
                          loading={deletingId === item.id}
                          aria-label={`Delete ${item.title}`}
                          onClick={() => askDelete(item.id, item.title)}
                        >
                          Delete
                        </IconButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={colSpan} className="text-center py-6 opacity-50">
                  No items found.
                </td>
              </tr>
            )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={confirm.open}
        title="Delete item?"
        confirmLabel="Delete"
        confirmColor="error"
        loading={!!deletingId && deletingId === confirm.payload?.id}
        onCancelAction={confirm.hide}
        onConfirmAction={confirmDelete}
      >
        {confirm.payload ? (
          <p>
            You are about to delete <span className="font-medium">{confirm.payload.title}</span>.
          </p>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
