"use client";

import type { FormGrid12Props, FieldProps, Span } from "./FormGrid.types";

export function FormGrid12({ children }: FormGrid12Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
      {children}
    </div>
  );
}

const spanClass = (span: Span) =>
  (
    {
      1: "md:col-span-1",
      2: "md:col-span-2",
      3: "md:col-span-3",
      4: "md:col-span-4",
      5: "md:col-span-5",
      6: "md:col-span-6",
      7: "md:col-span-7",
      8: "md:col-span-8",
      9: "md:col-span-9",
      10: "md:col-span-10",
      11: "md:col-span-11",
      12: "md:col-span-12",
    } as const
  )[span] ?? "md:col-span-12";

export function Field({ label, children, hint, span = 12 }: FieldProps) {
  return (
    <label className={`form-control ${spanClass(span)}`}>
      <div className="label">
        <span className="label-text text-sm">{label}</span>
      </div>
      {children}
      {hint && (
        <div className="label">
          <span className="label-text-alt text-xs text-base-content/60">
            {hint}
          </span>
        </div>
      )}
    </label>
  );
}
