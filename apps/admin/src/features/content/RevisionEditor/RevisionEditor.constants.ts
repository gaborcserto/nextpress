import type { RevisionAction } from "./RevisionEditor.types";

export const revisionActions = {
  save: {
    label: "Save working revision",
    success: "Working revision saved.",
    error: "Unable to save the working revision",
  },
  restore: {
    label: "Restore revision",
    success: "Revision restored as a new draft.",
    error: "Unable to restore the revision",
  },
  publish: {
    label: "Publish revision",
    success: "Revision published.",
    error: "Unable to publish the revision",
  },
  unpublish: {
    label: "Unpublish content",
    success: "Content unpublished.",
    error: "Unable to unpublish the content",
  },
  preview: {
    label: "Preview revision",
    success: "Revision preview loaded.",
    error: "Unable to preview the revision",
  },
} satisfies Record<
  RevisionAction,
  { label: string; success: string; error: string }
>;
