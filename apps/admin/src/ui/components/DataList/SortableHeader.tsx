"use client";

import { useState, type ReactNode } from "react";
import {
  FaSort,
  FaSortAmountDownAlt,
  FaSortAmountUpAlt,
  FaSortDown,
  FaSortUp,
} from "react-icons/fa";

import { Select } from "@/ui/primitives";

type SortDirection = "ascending" | "descending";
type SortValue = string | number | null;

export function MobileSortControl({
  label,
  directionLabel,
  options,
  value,
  direction,
  onFieldAction,
  onDirectionAction,
}: {
  label: string;
  directionLabel: string;
  options: { value: string; label: string }[];
  value: string;
  direction: "asc" | "desc";
  onFieldAction: (column: string) => void;
  onDirectionAction: () => void;
}) {
  return (
    <div className="admin-mobile-sort" role="group" aria-label={label}>
      <Select
        aria-label={label}
        value={value}
        options={options}
        className="select-sm w-full"
        onChangeAction={onFieldAction}
      />
      <button
        type="button"
        className="btn size-10 min-h-10 min-w-10 border-0 bg-transparent p-0 text-(--control-icon) shadow-none hover:text-(--control-icon-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-color)"
        aria-label={directionLabel}
        onClick={onDirectionAction}
      >
        {direction === "asc" ? (
          <FaSortAmountUpAlt size={18} aria-hidden="true" />
        ) : (
          <FaSortAmountDownAlt size={18} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export function useTableSort<Column extends string>(
  initialColumn: Column,
  initialDirection: SortDirection,
) {
  const [sort, setSort] = useState({
    column: initialColumn,
    direction: initialDirection,
  });

  function toggle(column: Column) {
    setSort((current) => ({
      column,
      direction:
        current.column === column && current.direction === "ascending"
          ? "descending"
          : "ascending",
    }));
  }

  function sortRows<Row>(
    rows: readonly Row[],
    columns: Record<Column, (row: Row) => SortValue>,
  ) {
    const value = columns[sort.column];
    const direction = sort.direction === "ascending" ? 1 : -1;

    return [...rows].sort((first, second) => {
      const a = value(first);
      const b = value(second);

      if (a === b) {
        return 0;
      }

      if (a === null) {
        return 1;
      }

      if (b === null) {
        return -1;
      }

      if (typeof a === "number" && typeof b === "number") {
        return direction * (a - b);
      }

      return direction * String(a).localeCompare(String(b));
    });
  }

  return { ...sort, toggle, sortRows };
}

export function SortableHeader<Column extends string>({
  column,
  sort,
  children,
}: {
  column: Column;
  sort: {
    column: Column;
    direction: SortDirection;
    toggle: (column: Column) => void;
  };
  children: ReactNode;
}) {
  const direction = sort.column === column ? sort.direction : undefined;
  const indicators = { ascending: FaSortUp, descending: FaSortDown };
  const Indicator = direction ? indicators[direction] : FaSort;

  return (
    <th
      role="columnheader"
      scope="col"
      aria-sort={direction}
      className="admin-sort-header"
    >
      <button
        type="button"
        className="admin-sort-button"
        onClick={() => sort.toggle(column)}
      >
        {children}
        <Indicator aria-hidden="true" className="size-[1em] shrink-0" />
      </button>
    </th>
  );
}

export function QuerySortableHeader({
  column,
  activeColumn,
  direction,
  onSortAction,
  children,
}: {
  column: string;
  activeColumn: string;
  direction: "asc" | "desc";
  onSortAction: (column: string) => void;
  children: ReactNode;
}) {
  const active = activeColumn === column;
  const Indicator = active
    ? direction === "asc"
      ? FaSortUp
      : FaSortDown
    : FaSort;

  return (
    <th
      role="columnheader"
      scope="col"
      aria-sort={
        active ? (direction === "asc" ? "ascending" : "descending") : "none"
      }
      className="admin-sort-header"
    >
      <button
        type="button"
        className="admin-sort-button"
        onClick={() => onSortAction(column)}
      >
        {children}
        <Indicator aria-hidden="true" className="size-[1em] shrink-0" />
      </button>
    </th>
  );
}

export function sortableTimestamp(value: string | null | undefined) {
  const timestamp = value ? Date.parse(value) : NaN;

  return Number.isFinite(timestamp) ? timestamp : null;
}
