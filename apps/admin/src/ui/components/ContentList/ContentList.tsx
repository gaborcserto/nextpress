"use client";

import Link from "next/link";
import { FaEdit, FaPlus, FaTrash } from "react-icons/fa";

import type { ContentListProps } from "./ContentList.types";

/**
 * Reusable admin list view for content items (Pages, Posts, etc.).
 * Renders a DaisyUI table with optional columns.
 *
 * Layout/behaviour is loosely inspired by the WordPress admin lists.
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

  return (
    <>
      {/* --- Header: title + primary action --- */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">{heading}</h1>
        <Link href={createHref} className="btn btn-primary">
          <FaPlus/> {createLabel}
        </Link>
      </div>

      {/* --- Loading state --- */}
      {isLoading && (
        <div className="flex items-center gap-2">
          <span className="loading loading-spinner" />
          <span>Loading…</span>
        </div>
      )}

      {/* --- Table --- */}
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
                      {/* Edit button */}
                      <Link
                        href={editHrefAction(item.id)}
                        className="btn btn-s btn-soft gap-1"
                      >
                        <FaEdit size={14} /> Edit
                      </Link>

                      {/* Optional delete button */}
                      {onDeleteAction && (
                        <button
                          className={`btn btn-s btn-error gap-1 ${
                            deletingId === item.id ? "loading" : ""
                          }`}
                          onClick={() => onDeleteAction(item.id)}
                          disabled={deletingId === item.id}
                        >
                          {deletingId === item.id ? (
                            "Delete"
                          ) : (
                            <>
                              <FaTrash size={14} /> Delete
                            </>
                          )}
                        </button>
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
    </>
  );
}
