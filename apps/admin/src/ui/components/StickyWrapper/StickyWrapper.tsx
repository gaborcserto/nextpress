"use client";

import type { StickyWrapperProps } from "./StickyWrapper.types";

export function StickyWrapper({ children }: StickyWrapperProps) {
  return (
    <div className="sticky bottom-4 z-20">
      <div className="bg-base-100 border border-base-300 rounded-xl shadow-md px-4 sm:px-6 py-3 flex items-center justify-end gap-2">
        {children}
      </div>
    </div>
  );
}

export default StickyWrapper;
