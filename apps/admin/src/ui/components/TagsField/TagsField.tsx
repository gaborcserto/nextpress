"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { TagsFieldProps } from "./TagsField.types";
import type { TagValue } from "@/lib/content/contracts";
import { TagMultiSelect } from "@/ui/components/TagMultiSelect";

export default function TagsField({
  entityId,
  value,
  defaultValue,
  onChangeAction,
  loadOptionsAction,
  createTagAction,
  loadEntityTagsAction,
  updateEntityTagsAction,
  label = "Tags",
  placeholder = "Add tag…",
  persist = true,
}: TagsFieldProps) {
  const isControlled = typeof value !== "undefined";
  const onChangeRef = useRef(onChangeAction);

  useEffect(() => {
    onChangeRef.current = onChangeAction;
  }, [onChangeAction]);

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
    if (!id || !loadEntityTagsAction) return;

    let cancelled = false;

    (async () => {
      setLoadingInitial(true);
      try {
        const loaded = await loadEntityTagsAction(id);
        if (cancelled) return;

        // If controlled, notify parent; otherwise store internally.
        if (isControlled) {
          onChangeRef.current?.(loaded);
        } else {
          setInternalTags(loaded);
          onChangeRef.current?.(loaded);
        }
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entityId, isControlled, loadEntityTagsAction]);

  const setTags = async (next: TagValue[]) => {
    // Update local state (or delegate to controlled parent)
    if (!isControlled) setInternalTags(next);

    // Notify parent callback
    onChangeAction?.(next);

    // Persist changes if managed mode is enabled
    const id = entityId?.trim();
    if (id && persist && updateEntityTagsAction) {
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
        loadOptionsAction={loadOptionsAction}
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
