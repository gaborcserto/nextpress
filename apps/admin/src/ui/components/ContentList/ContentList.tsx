"use client";

import { SessionDiscoverySchema } from "@nextpress/shared/api-contracts";
import Link from "next/link";
import { useState } from "react";
import { FaEdit, FaPlus, FaTrash } from "react-icons/fa";
import useSWR from "swr";

import { jsonFetcher } from "@/lib/api";
import { publicationLabels } from "@/lib/content/publication-status";
import {
  DataListEmptyRow,
  DataListLoading,
  DataListSurface,
} from "@/ui/components/DataList";
import {
  SortableHeader,
  useTableSort,
  sortableTimestamp,
} from "@/ui/components/DataList/SortableHeader";
import {
  Alert,
  Button,
  IconButton,
  Input,
  LinkIconButton,
  ConfirmDialog,
  Select,
  useConfirmDialog,
} from "@/ui/primitives";
import { AdminPageLayout } from "@/ui/shell/AdminPageLayout";

import ContentListPagination from "./ContentListPagination";

import type { ContentListProps } from "./ContentList.types";

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
  error,
  pagination,
  onRetryAction,
  deletingId,
  onDeleteAction,
  showAuthor = false,
  showCategories = false,
  showTags = false,
}: ContentListProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const { data: account } = useSWR("/api/discovery/session", async (url) =>
    SessionDiscoverySchema.parse(await jsonFetcher<unknown>(url)),
  );
  const role = account?.user?.role;
  const canDelete = role === "ADMIN" || role === "EDITOR";
  const sort = useTableSort<"title" | "author" | "status" | "updatedAt">(
    "updatedAt",
    "descending",
  );
  const baseCols = 4;
  const extraCols =
    Number(showAuthor) + Number(showCategories) + Number(showTags);
  const colSpan = baseCols + extraCols;

  const confirm = useConfirmDialog<ConfirmPayload>();
  const query = search.trim().toLocaleLowerCase();
  const filteredItems = items.filter((item) => {
    const matchesQuery = [item.title, item.slug].some((value) =>
      value.toLocaleLowerCase().includes(query),
    );

    return matchesQuery && (status === "all" || item.status === status);
  });

  const visibleItems = sort.sortRows(filteredItems, {
    title: (item) => item.title,
    author: (item) => item.author || null,
    status: (item) => item.status,
    updatedAt: (item) => sortableTimestamp(item.updatedAt),
  });

  const askDelete = (id: string, title: string) => confirm.show({ id, title });

  const confirmDelete = () => {
    if (!onDeleteAction) {
      return;
    }

    void confirm.run(({ id }) => onDeleteAction(id));
  };

  return (
    <AdminPageLayout
      title={heading}
      description="Search, status filtering, and sorting apply to the current page."
      actions={
        <LinkIconButton
          href={createHref}
          color="primary"
          icon={FaPlus}
          aria-label={createLabel}
        >
          {createLabel}
        </LinkIconButton>
      }
    >
      <div className="admin-list-toolbar">
        <Input
          label="Search this page"
          placeholder="Title or slug"
          fullWidth
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          label="Status"
          fullWidth
          value={status}
          options={[
            { value: "all", label: "All statuses" },
            { value: "DRAFT", label: "Draft" },
            { value: "PUBLISHED", label: "Published status" },
          ]}
          onChangeAction={setStatus}
        />
      </div>

      {error && (
        <div className="space-y-3">
          <Alert status="error" message={error} />
          {onRetryAction && <Button onClick={onRetryAction}>Retry</Button>}
        </div>
      )}
      {isLoading ? (
        <DataListLoading label={heading.toLowerCase()} />
      ) : (
        !error && (
          <DataListSurface>
            <table
              className="table admin-responsive-table w-full"
              role="table"
              aria-label={heading}
            >
              <thead role="rowgroup">
                <tr role="row">
                  <SortableHeader column="title" sort={sort}>
                    Title
                  </SortableHeader>
                  {showAuthor && (
                    <SortableHeader column="author" sort={sort}>
                      Author
                    </SortableHeader>
                  )}
                  {showCategories && (
                    <th role="columnheader" scope="col">
                      Categories
                    </th>
                  )}
                  {showTags && (
                    <th role="columnheader" scope="col">
                      Tags
                    </th>
                  )}
                  <SortableHeader column="status" sort={sort}>
                    Status
                  </SortableHeader>
                  <SortableHeader column="updatedAt" sort={sort}>
                    Last modified
                  </SortableHeader>
                  <th role="columnheader" scope="col" className="text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody role="rowgroup">
                {visibleItems.length ? (
                  visibleItems.map((item) => (
                    <tr key={item.id} role="row">
                      <td role="cell" className="admin-table-identity">
                        <Link
                          href={editHrefAction(item.id)}
                          className="font-semibold"
                        >
                          {item.title}
                        </Link>
                        <div className="text-sm text-(--text-muted)">
                          /{item.slug}
                        </div>
                      </td>

                      {showAuthor && (
                        <td role="cell">
                          <span className="admin-cell-label" aria-hidden="true">
                            Author
                          </span>
                          {item.author || "—"}
                        </td>
                      )}

                      {showCategories && (
                        <td role="cell">
                          <span className="admin-cell-label" aria-hidden="true">
                            Categories
                          </span>
                          {item.categories?.join(", ") || "—"}
                        </td>
                      )}

                      {showTags && (
                        <td role="cell">
                          <span className="admin-cell-label" aria-hidden="true">
                            Tags
                          </span>
                          {item.tags?.join(", ") || "—"}
                        </td>
                      )}

                      <td role="cell">
                        <span
                          className="badge badge-soft"
                          data-content-status={item.status}
                          title="Publication status reflects the API response time and updates when this list refreshes."
                        >
                          {publicationLabels[item.publicationState]}
                        </span>
                      </td>

                      <td role="cell" className="text-(--text-muted)">
                        <span className="admin-cell-label" aria-hidden="true">
                          Last modified
                        </span>
                        {item.dateLabel ?? "—"}
                      </td>

                      <td
                        role="cell"
                        className="admin-table-actions text-right"
                      >
                        <div className="flex flex-wrap justify-end gap-2">
                          <LinkIconButton
                            href={editHrefAction(item.id)}
                            size="sm"
                            variant="soft"
                            icon={FaEdit}
                            aria-label={`Edit ${item.title}`}
                          >
                            Edit
                          </LinkIconButton>

                          {onDeleteAction && canDelete && (
                            <IconButton
                              icon={FaTrash}
                              size="sm"
                              color="error"
                              variant="soft"
                              loading={deletingId === item.id}
                              disabled={Boolean(deletingId)}
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
                  <DataListEmptyRow colSpan={colSpan}>
                    {query || status !== "all"
                      ? "No matches on this page."
                      : "No items found."}
                  </DataListEmptyRow>
                )}
              </tbody>
            </table>
          </DataListSurface>
        )
      )}

      {pagination && (
        <ContentListPagination heading={heading} pagination={pagination} />
      )}

      <ConfirmDialog
        open={confirm.open}
        error={confirm.error}
        title="Delete item?"
        confirmLabel="Delete"
        confirmColor="error"
        loading={confirm.pending}
        onCancelAction={confirm.hide}
        onConfirmAction={confirmDelete}
      >
        {confirm.payload ? (
          <p>
            You are about to delete{" "}
            <span className="font-medium">{confirm.payload.title}</span>. This
            action is permanent.
          </p>
        ) : null}
      </ConfirmDialog>
    </AdminPageLayout>
  );
}
