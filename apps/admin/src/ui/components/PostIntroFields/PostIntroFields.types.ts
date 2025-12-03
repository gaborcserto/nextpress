import type { MediaValue, UploadFn } from "@/ui/components/ImageUploader";

export type PostIntroFieldsProps = {
  excerpt: string;
  onExcerptChangeAction: (value: string) => void;

  cover: MediaValue | null;
  onCoverChangeAction: (value: MediaValue | null) => void;

  /** Alt text is read/written directly from cover.alt */
  onCoverAltChangeAction: (alt: string) => void;

  uploaderAction?: UploadFn;
};
