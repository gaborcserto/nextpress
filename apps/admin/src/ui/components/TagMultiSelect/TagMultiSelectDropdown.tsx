"use client";

import type { TagMultiSelectDropdownProps } from "./TagMultiSelect.types";

/**
 * Highlight the matching part of the option label by underlining it.
 * Case-insensitive.
 */
function underlineMatch(label: string, query?: string) {
  const q = (query ?? "").trim();
  if (!q) return label;

  const lowerLabel = label.toLowerCase();
  const lowerQ = q.toLowerCase();

  const start = lowerLabel.indexOf(lowerQ);
  if (start === -1) return label;

  const end = start + q.length;

  return (
    <>
      {label.slice(0, start)}
      <u>{label.slice(start, end)}</u>
      {label.slice(end)}
    </>
  );
}

/**
 * Dropdown with search results and optional "Create …" CTA.
 * Positioned absolutely under the input (overlay) so it does NOT
 * push down the layout.
 */
export function TagMultiSelectDropdown({
  open,
  loading,
  options,
  showCreate,
  createLabel,
  listboxId,
  query,
  onSelectOptionAction,
  onCreateOptionAction,
}: TagMultiSelectDropdownProps) {
  if (!open || (!loading && options.length === 0 && !showCreate)) {
    return null;
  }

  return (
    <div
      id={listboxId}
      role="listbox"
      className="absolute left-0 top-full mt-1 w-full rounded-xl border border-base-300 bg-base-100 shadow z-50 max-h-64 overflow-auto"
    >
      {loading && (
        <div className="px-3 py-2 text-sm text-base-content/60">
          Searching…
        </div>
      )}

      {options.map((option) => (
        <button
          key={option.id ?? option.slug}
          type="button"
          role="option"
          aria-selected={false}
          className="block w-full text-left px-3 py-2 text-sm hover:bg-base-200"
          onMouseDown={(e) => {
            // Prevent focus/blur quirks from swallowing the click.
            e.preventDefault();
            onSelectOptionAction(option);
          }}
        >
          {underlineMatch(option.name, query)}
        </button>
      ))}

      {showCreate && (
        <button
          type="button"
          className="block w-full text-left px-3 py-2 text-sm text-primary hover:bg-base-200"
          onMouseDown={(e) => {
            e.preventDefault();
            void onCreateOptionAction();
          }}
        >
          {createLabel ?? "Create"}
        </button>
      )}
    </div>
  );
}
