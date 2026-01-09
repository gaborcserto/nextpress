import type { MediaValue, UploadFn } from "@/ui/components";
import type { Descendant } from "slate";

export type PostIntroFieldsProps = {
  excerpt: Descendant[];
  onExcerptChangeAction: (value: Descendant[]) => void;

  cover: MediaValue | null;
  onCoverChangeAction: (value: MediaValue | null) => void;

  /** Alt text is read/written directly from cover.alt */
  onCoverAltChangeAction: (alt: string) => void;

  uploaderAction?: UploadFn;
};
