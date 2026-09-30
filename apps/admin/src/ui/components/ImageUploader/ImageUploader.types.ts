"use client";

import type { MediaValue, UploadFn } from "@/lib/content/contracts";

export type ImageUploaderProps = {
  label?: string;
  value: MediaValue | null;

  /** Fired when the selected media changes (upload / remove) */
  onChangeAction: (value: MediaValue | null) => void;

  /** Upload implementation supplied by the owning feature. */
  uploaderAction?: UploadFn;

  disabled?: boolean;
  className?: string;
};
