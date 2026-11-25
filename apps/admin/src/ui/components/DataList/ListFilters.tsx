"use client";

import { Fragment, useId, useRef } from "react";
import { FaSearch } from "react-icons/fa";

import { Input, Select } from "@/ui/primitives";

import type { ReactNode } from "react";

import type { ContentListQuery } from "@/lib/content/useContentList";

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
}: ListFiltersProps) {
  const prefix = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const filterKey = JSON.stringify(
    fields.map(({ name }) => query.values.get(name)),
  );

  return (
    <form
      ref={formRef}
      className="admin-list-toolbar"
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
              className="select-sm w-auto max-w-full"
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
            <div key={name} className="relative w-48 max-w-full">
              <Input
                id={id}
                name={name}
                aria-label={label}
                placeholder={placeholder}
                type="search"
                maxLength={200}
                size="sm"
                className="w-full"
                defaultValue={value}
              />
              <button
                type="submit"
                aria-label={`Submit ${label.toLowerCase()}`}
                title={`Submit ${label.toLowerCase()}`}
                className="absolute end-1 top-1/2 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-(--radius-control) text-(--control-icon) hover:text-(--control-icon-hover) focus-visible:outline-(length:--focus-width) focus-visible:outline-offset-(--focus-offset) focus-visible:outline-(--focus-color)"
              >
                <FaSearch size={14} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </Fragment>
    </form>
  );
}
