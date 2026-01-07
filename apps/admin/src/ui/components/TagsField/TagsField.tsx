"use client";

import { useEffect, useMemo, useState } from "react";

import type { TagsFieldProps } from "./TagsField.types";
import {
  createTagAction,
  loadEntityTagsAction,
  loadTagOptionsAction,
  updateEntityTagsAction,
} from "@/lib/services/tag.client";
import { TagMultiSelect } from "@/ui/components/TagMultiSelect";
import type { TagValue } from "@/ui/components/TagMultiSelect";

export default function TagsField({
  entityId,
  value,
  defaultValue,
  onChangeAction,
  label = "Tags",
  placeholder = "Add tag…",
  persist = true,
}: TagsFieldProps) {
  const isControlled = typeof value !== "undefined";

  const [internalTags, setInternalTags] = useState<TagValue[]>(defaultValue ?? []);

  /**
   * Keep `tags` stable via useMemo to satisfy exhaustive-deps
   * and to avoid accidental referential changes.
   */
  const tags = useMemo<TagValue[]>(() => {
    return isControlled ? (value ?? []) : internalTags;
  }, [isControlled, value, internalTags]);

  const [loadingInitial, setLoadingInitial] = useState<boolean>(Boolean(entityId));
  const [saving, setSaving] = useState<boolean>(false);

  // Managed mode: load initial tags from DB if entityId is provided.
  useEffect(() => {
    const id = entityId?.trim();
    if (!id) return;

    let cancelled = false;

    (async () => {
      setLoadingInitial(true);
      try {
        const loaded = await loadEntityTagsAction(id);
        if (cancelled) return;

        // If controlled, notify parent; otherwise store internally.
        if (isControlled) {
          onChangeAction?.(loaded);
        } else {
          setInternalTags(loaded);
          onChangeAction?.(loaded);
        }
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally not including callbacks to avoid reloading loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, isControlled]);

  const setTags = async (next: TagValue[]) => {
    // Update local state (or delegate to controlled parent)
    if (!isControlled) setInternalTags(next);

    // Notify parent callback
    onChangeAction?.(next);

    // Persist changes if managed mode is enabled
    const id = entityId?.trim();
    if (id && persist) {
      setSaving(true);
      try {
        await updateEntityTagsAction(id, next.map((t) => t.id));
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div className="w-full space-y-1">
      <TagMultiSelect
        label={label}
        value={tags}
        onChangeAction={(next) => void setTags(next)}
        loadOptionsAction={loadTagOptionsAction}
        createTagAction={createTagAction}
        placeholder={placeholder}
      />

      {loadingInitial && (
        <div className="text-xs text-base-content/60">Loading tags…</div>
      )}

      {saving && !loadingInitial && (
        <div className="text-xs text-base-content/60">Saving…</div>
      )}

      {/* Screen reader helper: */}
      <div className="sr-only" aria-live="polite">
        {tags.length} tags selected
      </div>
    </div>
  );
}
