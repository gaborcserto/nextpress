"use client";

import { SessionDiscoverySchema } from "@nextpress/shared/api-contracts";
import Link from "next/link";
import { FaEdit, FaPlus, FaTrash } from "react-icons/fa";
import useSWR from "swr";

import { jsonFetcher } from "@/lib/api";
import { publicationLabels } from "@/lib/content/publication-status";
import {
  DataListEmptyRow,
  DataListLoading,
  DataListSurface,
} from "@/ui/components/DataList";
import ListFilters, {
  sortDirectionField,
} from "@/ui/components/DataList/ListFilters";
import RecordId from "@/ui/components/DataList/RecordId";
import {
  Alert,
  Button,
  IconButton,
  LinkIconButton,
  ConfirmDialog,
  useConfirmDialog,
} from "@/ui/primitives";
import { Badge } from "@/ui/primitives/Badge";
import { AdminPageLayout } from "@/ui/shell/AdminPageLayout";

import ContentListPagination from "./ContentListPagination";
import ListDate from "./ListDate";

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
  query,
  pageTypes,
  onRetryAction,
  deletingId,
  onDeleteAction,
}: ContentListProps) {
  const { data: account } = useSWR("/api/discovery/session", async (url) =>
    SessionDiscoverySchema.parse(await jsonFetcher<unknown>(url)),
  );
  const role = account?.user?.role;
  const canDelete = role === "ADMIN" || role === "EDITOR";
  const confirm = useConfirmDialog<ConfirmPayload>();
  const fields = [
    { name: "q", label: "Search", placeholder: "Title or slug" },
    {
      name: "status",
      label: "Status",
      options: [
        { value: "", label: "All statuses" },
        ...Object.entries(publicationLabels).map(([value, label]) => ({
          value,
          label,
        })),
      ],
    },
    ...(pageTypes
      ? [
          {
            name: "pageType",
            label: "Page type",
            options: [
              { value: "", label: "All page types" },
              ...Object.entries(pageTypes).map(([value, label]) => ({
                value,
                label,
              })),
            ],
          },
        ]
      : [
          { name: "tag", label: "Tag slug", placeholder: "Any tag" },
          {
            name: "category",
            label: "Category slug",
            placeholder: "Any category",
          },
        ]),
    {
      name: "sort",
      label: "Sort by",
      options: [
        { value: "", label: "Last modified (default)" },
        { value: "title", label: "Title" },
        { value: "createdAt", label: "Created date" },
        { value: "updatedAt", label: "Last modified date" },
        { value: "publishedAt", label: "Publication date" },
      ],
    },
    sortDirectionField,
  ];

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
      {query && <ListFilters query={query} fields={fields} />}

      {error && (
        <div className="space-y-3">
          <Alert status="error" message={error} />
          {onRetryAction && <Button onClick={onRetryAction}>Retry</Button>}
        </div>
      )}
      {isLoading && !items.length ? (
        <DataListLoading reserveSpace label={heading.toLowerCase()} />
      ) : (
        !error && (
          <DataListSurface
            reserveSpace
            pendingLabel={isLoading ? heading.toLowerCase() : undefined}
          >
            <table
              className="table admin-responsive-table admin-content-table w-full"
              role="table"
              aria-label={heading}
            >
              <thead role="rowgroup">
                <tr role="row">
                  <th scope="col">Title</th>
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
                  <th scope="col">Last modified</th>
                  <th role="columnheader" scope="col" className="text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody role="rowgroup">
                {items.length ? (
                  items.map((item) => (
                    <tr key={item.id} role="row">
                      <th
                        scope="row"
                        role="rowheader"
                        className="admin-table-identity"
                      >
                        <Link
                          href={editHrefAction(item.id)}
                          className="font-semibold"
                        >
                          {item.title}
                        </Link>
                        <div className="text-sm text-(--text-muted)">
                          /{item.slug}
                          {item.typeLabel && (
                            <span> &middot; {item.typeLabel}</span>
                          )}
                        </div>
                        <RecordId id={item.id} />
                      </th>

                      <td role="cell">
                        <span className="admin-cell-label" aria-hidden="true">
                          Status
                        </span>
                        <Badge
                          data-content-status={item.status}
                          title="Publication status reflects the API response time and updates when this list refreshes."
                        >
                          {publicationLabels[item.publicationState]}
                        </Badge>
                        <div className="admin-publication-timing">
                          {item.publicationState === "PUBLISHED" && (
                            <div>
                              <ListDate value={item.publishedAt} />
                            </div>
                          )}
                          {item.scheduledAt && (
                            <div>
                              <ListDate value={item.scheduledAt} />
                            </div>
                          )}
                        </div>
                      </td>

                      <td role="cell" className="admin-record-date">
                        <span className="admin-cell-label" aria-hidden="true">
                          Created
                        </span>
                        <ListDate value={item.createdAt} />
                      </td>
                      <td role="cell" className="admin-record-date">
                        <span className="admin-cell-label" aria-hidden="true">
                          Last modified
                        </span>
                        <ListDate value={item.updatedAt} />
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
                              variant="ghost"
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
                  <DataListEmptyRow colSpan={5}>
                    No items found.
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
