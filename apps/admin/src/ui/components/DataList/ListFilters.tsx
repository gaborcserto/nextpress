"use client";

import { Fragment, useId } from "react";

import { Button, Input, Select } from "@/ui/primitives";

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

export default function ListFilters({ query, fields }: ListFiltersProps) {
  const prefix = useId();
  const filterKey = JSON.stringify(
    fields.map(({ name }) => query.values.get(name)),
  );

  return (
    <form
      className="admin-list-toolbar"
      onSubmit={(event) => {
        event.preventDefault();
        query.onApplyAction(new FormData(event.currentTarget));
      }}
    >
      <Fragment key={filterKey}>
        {fields.map(({ name, label, options, placeholder }) => {
          const id = prefix + name;
          const value = query.values.get(name) ?? "";

          return options ? (
            <Select
              key={name}
              id={id}
              name={name}
              label={label}
              fullWidth
              defaultValue={
                options.some((option) => option.value === value)
                  ? value
                  : options[0]?.value
              }
              options={options}
            />
          ) : (
            <Input
              key={name}
              id={id}
              name={name}
              label={label}
              placeholder={placeholder}
              type="search"
              maxLength={200}
              fullWidth
              defaultValue={value}
            />
          );
        })}
      </Fragment>
      <Button type="submit" variant="outline" className="self-end">
        Apply filters
      </Button>
    </form>
  );
}
