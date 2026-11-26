import type {
  RevisionListSchema,
  RevisionRecordSchema,
} from "@nextpress/shared/revisions";
import type { z } from "zod";

export type RevisionList = z.infer<typeof RevisionListSchema>;
export type RevisionRecord = z.infer<typeof RevisionRecordSchema>;
export type RevisionEditorProps = { pageId: string; kind?: "pages" | "posts" };
export type RevisionAction =
  | "save"
  | "restore"
  | "publish"
  | "unpublish"
  | "preview";
export type SavedRevisionAction = Extract<
  RevisionAction,
  "restore" | "preview"
>;
