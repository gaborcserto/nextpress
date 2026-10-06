"use client";

import { useEffect, useRef, useState } from "react";

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

  const tags = isControlled ? (value ?? []) : internalTags;

  const [loadingInitial, setLoadingInitial] = useState<boolean>(Boolean(entityId && loadEntityTagsAction));
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);

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
      } catch {
        if (!cancelled) setError("Unable to load tags. Please try again.");
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entityId, isControlled, loadEntityTagsAction]);

  const setTags = async (next: TagValue[]) => {
    if (savingRef.current) return;
    setError(null);
    // Update local state (or delegate to controlled parent)
    if (!isControlled) setInternalTags(next);

    // Notify parent callback
    onChangeAction?.(next);

    // Persist changes if managed mode is enabled
    const id = entityId?.trim();
    if (id && persist && updateEntityTagsAction) {
      savingRef.current = true;
      setSaving(true);
      try {
        await updateEntityTagsAction(id, next.map((t) => t.id));
      } catch {
        if (!isControlled) setInternalTags(tags);
        onChangeAction?.(tags);
        setError("Unable to save tags. Please try again.");
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    }
  };

  return (
    <div className="w-full space-y-1">
      <fieldset disabled={loadingInitial || saving}>
      <TagMultiSelect
        label={label}
        value={tags}
        onChangeAction={(next) => void setTags(next)}
        loadOptionsAction={loadOptionsAction}
        createTagAction={createTagAction}
        placeholder={placeholder}
      />
      </fieldset>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}

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
