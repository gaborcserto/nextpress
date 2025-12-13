import type { KeyboardEvent, InputHTMLAttributes } from "react";

export type TagValue = {
  id: string;
  name: string;
  slug: string;
};

/** Async function to load tag options from API */
export type TagLoadOptionsFn = (query: string) => Promise<TagValue[]>;

/** Async function to create a new tag in API */
export type TagCreateFn = (name: string) => Promise<TagValue>;

export type TagMultiSelectProps = {
  label?: string;
  /** Selected tags */
  value?: TagValue[];
  /** Called whenever selection changes */
  onChangeAction: (value: TagValue[]) => void;
  loadOptionsAction: TagLoadOptionsFn;
  createTagAction: TagCreateFn;
  placeholder?: string;
};

export type TagMultiSelectChipProps = {
  tag: TagValue;
  onRemoveAction: (tag: TagValue) => void;
};

/**
 * Input props:
 * - extend standard HTML input attributes (id, aria-*, etc)
 * - but use string value + custom onChange/onKeyDown
 */
export type TagMultiSelectInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "onKeyDown"
> & {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
};

export type TagMultiSelectDropdownProps = {
  open: boolean;
  loading: boolean;
  options: TagValue[];
  showCreate: boolean;
  createLabel?: string;

  /** Optional ARIA listbox id */
  listboxId?: string;

  /** Current query for highlighting matches */
  query?: string;

  onSelectOptionAction: (tag: TagValue) => void;
  onCreateOptionAction: () => Promise<void> | void;
};
