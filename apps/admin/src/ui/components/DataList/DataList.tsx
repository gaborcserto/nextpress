import type { ReactNode } from "react";

export function DataListSurface({
  children,
  label,
  reserveSpace = false,
  pendingLabel,
  adaptive = false,
}: {
  children: ReactNode;
  label?: string;
  reserveSpace?: boolean;
  pendingLabel?: string;
  adaptive?: boolean;
}) {
  return (
    <div
      className={
        "admin-surface admin-list-surface w-full min-w-0" +
        (adaptive ? " admin-adaptive-list" : "") +
        (reserveSpace ? " admin-discovery-results" : "")
      }
      role={label ? "region" : undefined}
      aria-label={label}
      tabIndex={label ? 0 : undefined}
    >
      {pendingLabel ? (
        <>
          <span role="status" className="sr-only">
            Loading {pendingLabel}…
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

export function DataListScrollableResults({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function DataListLoading({
  label,
  message,
  reserveSpace,
}: {
  label: string;
  message?: string;
  reserveSpace?: boolean;
}) {
  return (
    <DataListSurface reserveSpace={reserveSpace}>
      <div className="admin-list-loading" role="status">
        <span className="sr-only">{message ?? `Loading ${label}…`}</span>
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
