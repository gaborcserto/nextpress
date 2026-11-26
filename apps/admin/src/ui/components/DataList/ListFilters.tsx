"use client";

import { Fragment, useId, useRef } from "react";

import { Select } from "@/ui/primitives";

import { ToolbarSearch, type ToolbarSearchWidth } from "./ToolbarSearch";

import type { ReactNode } from "react";

import type { ContentListQuery } from "@/hooks/useContentList";

type FilterField = {
  name: string;
  label: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
};

type ListFiltersProps = {
  query: ContentListQuery;
  fields: FilterField[];
  children?: ReactNode;
  trailingControls?: ReactNode;
  searchWidth?: ToolbarSearchWidth;
};

export const sortDirectionField = {
  name: "direction",
  label: "Sort direction",
  options: [
    { value: "", label: "Default direction" },
    { value: "asc", label: "Ascending" },
    { value: "desc", label: "Descending" },
  ],
};

export default function ListFilters({
  query,
  fields,
  children,
  trailingControls,
  searchWidth,
}: ListFiltersProps) {
  const prefix = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const filterKey = JSON.stringify(
    fields.map(({ name }) => query.values.get(name)),
  );

  return (
    <form
      ref={formRef}
      className="admin-filter-toolbar admin-list-toolbar"
      onSubmit={(event) => {
        event.preventDefault();
        query.onApplyAction(new FormData(event.currentTarget));
      }}
    >
      {children}
      <Fragment key={filterKey}>
        {fields.map(({ name, label, options, placeholder }) => {
          const id = prefix + name;
          const value = query.values.get(name) ?? "";

          return options ? (
            <Select
              key={name}
              id={id}
              name={name}
              aria-label={label}
              defaultValue={
                options.some((option) => option.value === value)
                  ? value
                  : options[0]?.value
              }
              options={options}
              className="select-sm"
              onChangeAction={(selected) => {
                const form = formRef.current;

                if (form) {
                  const filters = new FormData(form);
                  filters.set(name, selected);
                  query.onApplyAction(filters);
                }
              }}
            />
          ) : (
            <ToolbarSearch
              key={name}
              id={id}
              name={name}
              aria-label={label}
              placeholder={placeholder}
              type="search"
              width={searchWidth}
              maxLength={200}
              defaultValue={value}
              submitLabel={`Submit ${label.toLowerCase()}`}
            />
          );
        })}
      </Fragment>
      {trailingControls}
    </form>
  );
}
