"use client";

import type { TagMultiSelectChipProps } from "./TagMultiSelect.types";

/**
 * Small badge-like chip representing a selected tag.
 */
export function TagMultiSelectChip({
  tag,
  onRemoveAction,
}: TagMultiSelectChipProps) {
  return (
    <span className="badge badge-sm badge-neutral gap-1">
      {tag.name}
      <button
        type="button"
        className="ml-1 text-xs"
        aria-label={`Remove ${tag.name}`}
        onClick={(event) => {
          event.stopPropagation();
          onRemoveAction(tag);
        }}
      >
        ✕
      </button>
    </span>
  );
}
