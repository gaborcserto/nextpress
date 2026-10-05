import type { ReactNode } from "react";

export function DataListSurface({ children }: { children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-base-300 bg-base-100 shadow">
      {children}
    </div>
  );
}

export function DataListLoading({ label }: { label: string }) {
  return (
    <DataListSurface>
      <div className="flex min-h-48 items-center justify-center gap-2" role="status">
        <span className="loading loading-spinner" aria-hidden="true" />
        <span>Loading {label}…</span>
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
    <tr>
      <td colSpan={colSpan}>
        <div className="px-6 py-8 text-center text-sm text-base-content/60">
          {children}
        </div>
      </td>
    </tr>
  );
}
