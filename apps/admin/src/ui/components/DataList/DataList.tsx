import type { ReactNode } from "react";

export function DataListSurface({
  children,
  label,
  reserveSpace = false,
  pendingLabel,
}: {
  children: ReactNode;
  label?: string;
  reserveSpace?: boolean;
  pendingLabel?: string;
}) {
  return (
    <div
      className={
        "w-full overflow-x-auto rounded-(--radius-surface) border border-(--surface-border) bg-base-100" +
        (reserveSpace ? " admin-discovery-results" : "")
      }
      role={label ? "region" : undefined}
      aria-label={label}
      tabIndex={label ? 0 : undefined}
    >
      {pendingLabel ? (
        <>
          <span role="status" className="sr-only">
            Loading {pendingLabel}?
          </span>
          <div inert aria-busy="true" className="opacity-50">
            {children}
          </div>
        </>
      ) : (
        children
      )}
    </div>
  );
}

export function DataListLoading({
  label,
  reserveSpace,
}: {
  label: string;
  reserveSpace?: boolean;
}) {
  return (
    <DataListSurface reserveSpace={reserveSpace}>
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
