"use client";

import type { StickyWrapperProps } from "./StickyWrapper.types";

export function StickyWrapper({ children }: StickyWrapperProps) {
  return (
    <div className="sticky bottom-2 z-10 sm:bottom-4">
      <div className="flex flex-wrap items-center justify-end gap-2 rounded-(--radius-surface) border border-(--surface-border) bg-base-100 px-3 py-2 sm:px-4 [&>p]:mr-auto [&>p]:basis-full sm:[&>p]:basis-auto [&>p]:min-w-0 [&>p]:wrap-anywhere [&>p]:text-sm">
        {children}
      </div>
    </div>
  );
}

export default StickyWrapper;
