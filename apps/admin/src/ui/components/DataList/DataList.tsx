import type { ReactNode } from "react";

export function DataListSurface({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <div
      className="w-full overflow-x-auto rounded-(--radius-surface) border border-(--surface-border) bg-base-100"
      role={label ? "region" : undefined}
      aria-label={label}
      tabIndex={label ? 0 : undefined}
    >
      {children}
    </div>
  );
}

export function DataListLoading({ label }: { label: string }) {
  return (
    <DataListSurface>
      <div className="admin-list-loading" role="status">
        <span className="sr-only">Loading {label}…</span>
        {[0, 1, 2].map((row) => (
          <div key={row} className="admin-skeleton-row" aria-hidden="true">
            <div className="skeleton h-4 w-3/5" />
            <div className="skeleton h-4 w-20 max-w-full" />
          </div>
        ))}
      </div>
    </DataListSurface>
  );
}

export function DataListEmptyRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <tr role="row" className="admin-table-empty">
      <td role="cell" colSpan={colSpan}>
        <div className="px-6 py-8 text-center text-sm text-(--text-muted)">
          {children}
        </div>
      </td>
    </tr>
  );
}
