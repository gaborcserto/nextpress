"use client";

import {
  SessionDiscoverySchema,
  TaxonomyListSchema,
} from "@nextpress/shared/api-contracts";
import { useState } from "react";
import { FaEdit, FaPlus, FaTrash } from "react-icons/fa";
import useSWR from "swr";

import { jsonFetcher } from "@/lib/api";
import { publicationLabels } from "@/lib/content/publication-status";
import { useAdminLocale } from "@/lib/i18n/admin-locale";
import {
  DataListEmptyRow,
  DataListLoading,
  DataListSurface,
} from "@/ui/components/DataList";
import ListFilters from "@/ui/components/DataList/ListFilters";
import {
  MobileSortControl,
  QuerySortableHeader,
} from "@/ui/components/DataList/SortableHeader";
import { PublicationStatusBadge } from "@/ui/components/PublicationStatusBadge";
import { TruncatedText } from "@/ui/components/TruncatedText/TruncatedText";
import {
  AdminAsyncButton,
  AdminButton,
  Alert,
  LinkIconButton,
  ConfirmDialog,
  Tooltip,
  useConfirmDialog,
} from "@/ui/primitives";
import { AdminPageLayout } from "@/ui/shell/AdminPageLayout";

import ContentListPagination from "./ContentListPagination";
import ListDate from "./ListDate";

import type { ContentListProps } from "./ContentList.types";

type ConfirmPayload = { id: string; title: string };

function ProtectedPageDeleteButton({
  title,
  id,
}: {
  id: string;
  title: string;
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const tooltipId = `system-page-delete-${id}`;

  return (
    <Tooltip
      id={tooltipId}
      content="System pages cannot be deleted."
      onOpenChange={setTooltipOpen}
    >
      <span
        role="group"
        tabIndex={0}
        aria-label={`Delete ${title} unavailable`}
        aria-describedby={tooltipOpen ? tooltipId : undefined}
      >
        <AdminButton
          icon={FaTrash}
          size="sm"
          color="error"
          variant="ghost"
          disabled
          aria-label={`Delete ${title}`}
        >
          Delete
        </AdminButton>
      </span>
    </Tooltip>
  );
}

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
  const { data: taxonomyOptions = { TAG: [], CATEGORY: [] } } = useSWR(
    heading === "Posts" ? "/api/admin/tags?type=TAG&type=CATEGORY" : null,
    async () => {
      const loadType = async (type: "TAG" | "CATEGORY") => {
        const first = TaxonomyListSchema.parse(
          await jsonFetcher<unknown>(`/api/admin/tags?type=${type}&limit=100`),
        );

        const pages = await Promise.all(
          Array.from({ length: Math.max(0, first.pages - 1) }, (_, index) =>
            jsonFetcher<unknown>(
              `/api/admin/tags?type=${type}&limit=100&page=${index + 2}`,
            ).then((response) => TaxonomyListSchema.parse(response)),
          ),
        );

        return [...first.items, ...pages.flatMap((page) => page.items)].map(
          ({ slug, name }) => ({ value: slug, label: name }),
        );
      };

      const [tags, categories] = await Promise.all([
        loadType("TAG"),
        loadType("CATEGORY"),
      ]);

      return { TAG: tags, CATEGORY: categories };
    },
  );
  const role = account?.user?.role;
  const locale = useAdminLocale();
  const authorLabel = locale === "hu" ? "Szerző" : "Author";
  const unassignedAuthorLabel =
    locale === "hu" ? "Nincs hozzárendelve" : "Unassigned";
  const emptyListLabel = locale === "hu" ? "Nincs találat." : "No items found.";
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
          {
            name: "tag",
            label: "Tag",
            options: [{ value: "", label: "Any tag" }, ...taxonomyOptions.TAG],
          },
          {
            name: "category",
            label: "Category",
            options: [
              { value: "", label: "Any category" },
              ...taxonomyOptions.CATEGORY,
            ],
          },
        ]),
  ];
  const sortColumn = query?.values.get("sort") ?? "updatedAt";
  const sortDirection = query?.values.get("direction") ?? "desc";

  const sortable = (column: string, label: string, className?: string) =>
    query ? (
      <QuerySortableHeader
        className={className}
        column={column}
        activeColumn={sortColumn}
        direction={sortDirection === "asc" ? "asc" : "desc"}
        onSortAction={query.onSortAction}
      >
        {label}
      </QuerySortableHeader>
    ) : (
      <th scope="col" className={className}>
        {label}
      </th>
    );

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
      {error && (
        <div className="space-y-3">
          <Alert status="error" message={error} />
          {onRetryAction && (
            <AdminButton onClick={onRetryAction}>Retry</AdminButton>
          )}
        </div>
      )}
      {isLoading && !items.length ? (
        <DataListLoading reserveSpace label={heading.toLowerCase()} />
      ) : (
        !error && (
          <DataListSurface
            adaptive
            reserveSpace
            pendingLabel={isLoading ? heading.toLowerCase() : undefined}
          >
            {query && (
              <ListFilters
                query={query}
                fields={fields}
                searchWidth="responsive"
                trailingControls={
                  <MobileSortControl
                    className="admin-content-sort"
                    label={locale === "hu" ? "Rendezés" : "Sort by"}
                    directionLabel={
                      locale === "hu"
                        ? "Rendezési irány váltása"
                        : "Change sort direction"
                    }
                    options={[
                      { value: "title", label: "Title" },
                      { value: "slug", label: "Slug" },
                      { value: "author", label: authorLabel },
                      { value: "createdAt", label: "Created" },
                      { value: "updatedAt", label: "Last modified" },
                    ]}
                    value={sortColumn}
                    direction={sortDirection === "asc" ? "asc" : "desc"}
                    onFieldAction={query.onSortFieldAction}
                    onDirectionAction={() => query.onSortAction(sortColumn)}
                  />
                }
              />
            )}
            <table
              className="table admin-responsive-table admin-content-table w-full"
              role="table"
              aria-label={heading}
            >
              <thead role="rowgroup">
                <tr role="row">
                  {sortable("title", "Title")}
                  {sortable("author", authorLabel, "admin-content-secondary")}
                  <th scope="col">Status</th>
                  {sortable("createdAt", "Created", "admin-content-secondary")}
                  {sortable("updatedAt", "Last modified")}
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
                        <div className="flex min-w-0 items-center gap-2">
                          <TruncatedText
                            className="max-w-[32rem] font-semibold"
                            href={editHrefAction(item.id)}
                            value={item.title}
                          />
                          {item.systemPage && (
                            <span className="admin-badge admin-badge-info shrink-0">
                              System page
                            </span>
                          )}
                        </div>
                        <div className="flex min-w-0 items-baseline gap-1 text-sm text-(--text-muted)">
                          <TruncatedText
                            value={item.publicPath ?? `/${item.slug}`}
                          />
                          {item.typeLabel && (
                            <span className="shrink-0">
                              &middot; {item.typeLabel}
                            </span>
                          )}
                        </div>
                        <div className="admin-content-compact-metadata text-sm text-(--text-muted)">
                          <div className="flex min-w-0 gap-1">
                            <span className="shrink-0">{authorLabel}:</span>
                            <TruncatedText
                              value={item.authorName || unassignedAuthorLabel}
                            />
                          </div>
                          <div>
                            {"Created: "}
                            <ListDate value={item.createdAt} />
                          </div>
                        </div>
                      </th>

                      <td
                        role="cell"
                        className="admin-content-author admin-content-secondary"
                      >
                        <div className="flex min-w-0 items-baseline">
                          <span
                            className="admin-cell-label shrink-0"
                            aria-hidden="true"
                          >
                            {authorLabel}
                          </span>
                          <TruncatedText
                            value={item.authorName || unassignedAuthorLabel}
                          />
                        </div>
                      </td>

                      <td role="cell">
                        <span className="admin-cell-label" aria-hidden="true">
                          Status
                        </span>
                        <PublicationStatusBadge
                          status={item.publicationState}
                        />
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

                      <td
                        role="cell"
                        className="admin-record-date admin-content-secondary"
                      >
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
                            variant="ghost"
                            icon={FaEdit}
                            aria-label={`Edit ${item.title}`}
                            title={`Edit ${item.title}`}
                          >
                            Edit
                          </LinkIconButton>

                          {onDeleteAction &&
                            canDelete &&
                            (item.canDelete === false ? (
                              <ProtectedPageDeleteButton
                                id={item.id}
                                title={item.title}
                              />
                            ) : (
                              <AdminAsyncButton
                                icon={FaTrash}
                                size="sm"
                                color="error"
                                variant="ghost"
                                loading={deletingId === item.id}
                                disabled={Boolean(deletingId)}
                                aria-label={`Delete ${item.title}`}
                                title={`Delete ${item.title}`}
                                onClick={() => askDelete(item.id, item.title)}
                              >
                                Delete
                              </AdminAsyncButton>
                            ))}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <DataListEmptyRow colSpan={6}>
                    {emptyListLabel}
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
