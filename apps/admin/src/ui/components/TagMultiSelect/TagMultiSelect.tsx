"use client";

import {
  useRef,
  useState,
  useId,
  useMemo,
  type KeyboardEvent,
} from "react";

import type { TagMultiSelectProps, TagValue } from "./TagMultiSelect.types";
import { TagMultiSelectChip } from "./TagMultiSelectChip";
import { TagMultiSelectDropdown } from "./TagMultiSelectDropdown";
import { TagMultiSelectInput } from "./TagMultiSelectInput";
import { useTagMultiSelectSearch } from "./TagMultiSelectSearch.hook";

/** Small utility to compose classNames conditionally. */
const cx = (...classes: Array<string | false | undefined>) =>
  classes.filter(Boolean).join(" ");

export function TagMultiSelect({
  label,
  value,
  onChangeAction,
  loadOptionsAction,
  createTagAction,
  placeholder = "Add tag…",
}: TagMultiSelectProps) {
  /**
   * Ensure selectedTags has a stable reference
   * to satisfy exhaustive-deps and avoid unnecessary recalculations.
   */
  const selectedTags = useMemo<TagValue[]>(() => {
    return Array.isArray(value) ? value : [];
  }, [value]);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();
  const listboxId = useId();

  const { options, loading, setOptions } = useTagMultiSelectSearch(
    query,
    loadOptionsAction,
    2
  );

  const trimmedQuery = query.trim();

  /**
   * Hide already-selected tags from the dropdown,
   * so clicking an item always produces a visible action.
   */
  const selectableOptions = useMemo(() => {
    const selectedIds = new Set(selectedTags.map((t) => t.id));
    return options.filter((opt) => !selectedIds.has(opt.id));
  }, [options, selectedTags]);

  /** Add tag (avoid duplicates) */
  const addTag = (tag: TagValue): void => {
    const alreadySelected = selectedTags.some((current) => current.id === tag.id);
    if (alreadySelected) return;

    onChangeAction([...selectedTags, tag]);
    resetSearch();
  };

  /** Remove tag */
  const removeTag = (tag: TagValue): void => {
    onChangeAction(selectedTags.filter((current) => current.id !== tag.id));
  };

  /** Reset search input + dropdown */
  const resetSearch = (): void => {
    setQuery("");
    setOptions([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  /**
   * Keyboard UX:
   * - Enter with non-empty query:
   *    - If there are search results → pick the first selectable one.
   *    - Otherwise → create a new tag via `createTagAction`.
   * - Backspace with empty query:
   *    - Remove the last selected tag.
   * - Escape: close dropdown.
   */
  const handleKeyDown = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && trimmedQuery) {
      event.preventDefault();

      if (selectableOptions.length > 0) {
        addTag(selectableOptions[0]);
        return;
      }

      const newTag = await createTagAction(trimmedQuery);
      addTag(newTag);
      return;
    }

    if (event.key === "Backspace" && !query && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1]);
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const showCreate =
    trimmedQuery.length > 0 &&
    !selectableOptions.some(
      (option) => option.name.toLowerCase() === trimmedQuery.toLowerCase()
    );

  const handleCreateClick = async (): Promise<void> => {
    if (!trimmedQuery) return;
    const newTag = await createTagAction(trimmedQuery);
    addTag(newTag);
  };

  return (
    <div className="form-control w-full">
      {label && (
        <label className="label" htmlFor={inputId}>
          <span className="label-text">{label}</span>
        </label>
      )}

      <div className="relative">
        <div
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-owns={listboxId}
          aria-controls={listboxId}
          aria-label={label ?? "Tag selector"}
          className={cx(
            "input input-bordered w-full flex items-center gap-2",
            "min-h-12 px-2 py-1"
          )}
          onClick={() => {
            inputRef.current?.focus();
            setOpen(true);
          }}
        >
          <TagMultiSelectInput
            ref={inputRef}
            id={inputId}
            value={query}
            aria-autocomplete="list"
            aria-controls={listboxId}
            onChange={(nextValue) => {
              setQuery(nextValue);
              setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cx(
              // Make the input comfortable: not full-width, but still responsive.
              "bg-transparent outline-none",
              "w-full max-w-md"
            )}
          />
        </div>

        <TagMultiSelectDropdown
          open={open}
          loading={loading}
          options={selectableOptions}
          listboxId={listboxId}
          query={trimmedQuery}
          showCreate={showCreate}
          createLabel={trimmedQuery ? `Create “${trimmedQuery}”` : undefined}
          onSelectOptionAction={addTag}
          onCreateOptionAction={handleCreateClick}
        />
      </div>

      {selectedTags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <TagMultiSelectChip
              key={`${tag.id ?? "new"}-${tag.slug}`}
              tag={tag}
              onRemoveAction={removeTag}
            />
          ))}
        </div>
      )}

      {/* Screen reader summary */}
      <div className="sr-only" aria-live="polite">
        {selectedTags.length} tags selected
      </div>
    </div>
  );
}
