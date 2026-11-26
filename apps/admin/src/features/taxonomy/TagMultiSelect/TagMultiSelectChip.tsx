"use client";

import { FaTimes } from "react-icons/fa";

import type { TagMultiSelectChipProps } from "./TagMultiSelect.types";

/**
 * Selected tag "chip" rendered as a DaisyUI button.
 * The X button removes the tag.
 */
export function TagMultiSelectChip({
  tag,
  onRemoveAction,
}: TagMultiSelectChipProps) {
  return (
    <button
      type="button"
      className="btn btn-sm btn-soft btn-primary gap-2"
      onClick={() => onRemoveAction(tag)}
      aria-label={`Remove tag ${tag.name}`}
      title="Remove"
    >
      <span className="truncate max-w-56">{tag.name}</span>
      <span aria-hidden="true" className="opacity-70">
        <FaTimes />
      </span>
    </button>
  );
}
