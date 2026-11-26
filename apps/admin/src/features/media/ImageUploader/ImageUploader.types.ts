"use client";

import type { EditorImage } from "@nextpress/shared/media";

export type ImageUploaderProps = {
  label?: string;
  value: EditorImage | null;

  /** Fired when the selected media changes (upload / remove) */
  onChangeAction: (value: EditorImage | null) => void;

  /** Upload implementation supplied by the owning feature. */
  uploaderAction?: (file: File) => Promise<EditorImage>;

  disabled?: boolean;
  className?: string;
};
