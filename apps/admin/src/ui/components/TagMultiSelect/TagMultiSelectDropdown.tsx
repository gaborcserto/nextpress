"use client";

import type { TagMultiSelectDropdownProps } from "./TagMultiSelect.types";

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
          onClick={() => onSelectOptionAction(option)}
        >
          {option.name}
        </button>
      ))}

      {showCreate && (
        <button
          type="button"
          className="block w-full text-left px-3 py-2 text-sm text-primary hover:bg-base-200"
          onClick={() => void onCreateOptionAction()}
        >
          {createLabel ?? "Create"}
        </button>
      )}
    </div>
  );
}
