"use client";

export type MediaValue = {
  id: string;
  url: string;
  alt?: string | null;
};

export type UploadFn = (file: File) => Promise<MediaValue>;

export type ImageUploaderProps = {
  label?: string;
  value: MediaValue | null;

  /** Fired when the selected media changes (upload / remove) */
  onChangeAction: (value: MediaValue | null) => void;

  /**
   * Optionally override upload backend.
   * If not provided, local /api/uploads endpoint is used.
   */
  uploaderAction?: UploadFn;

  disabled?: boolean;
  className?: string;
};
