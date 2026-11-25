"use client";

import { useContext } from "react";
import { createPortal } from "react-dom";
import { FaCalendarAlt, FaClock, FaSave, FaTimes } from "react-icons/fa";

import {
  publicationLabels,
  savedPublicationState,
} from "@/lib/content/publication-status";
import { useAdminLocale } from "@/lib/i18n/admin-locale";
import { Badge } from "@/ui/primitives/Badge";
import {
  AdminAsyncButton,
  AdminButton,
  LinkButton,
} from "@/ui/primitives/Buttons";
import { EditorHeaderContext } from "@/ui/shell/EditorHeaderContext";

import type { ReactNode } from "react";

import type { PublicationFields } from "@/lib/content/publication-status";
import type { PrivateDraftControls } from "@/lib/content/usePrivateDraft";

type EditorActionsProps = {
  publication: PublicationFields;
  saveStatus: string;
  submitLabel: string;
  saving: boolean;
  revisionsHref?: string;
  privateDraft: PrivateDraftControls | null;
  preview: ReactNode;
  onCancelAction: () => void;
};

function privateSaveStatus(draft: PrivateDraftControls) {
  switch (draft.phase) {
    case "saving":
      return "Saving private draft...";
    case "unsaved":
      return "Unsaved private changes";
    case "saved":
      return draft.version
        ? `Private draft saved \u00b7 revision ${draft.version}`
        : "No private revision saved yet";
    default:
      return draft.message;
  }
}

export function EditorActions({
  publication,
  saveStatus,
  submitLabel,
  saving,
  revisionsHref,
  privateDraft,
  preview,
  onCancelAction,
}: EditorActionsProps) {
  const hu = useAdminLocale() === "hu";
  const headerSlot = useContext(EditorHeaderContext);
  const actions = (
    <div className="admin-action-layout">
      <div className="admin-action-controls">
        <div className="admin-editor-buttons">
          {revisionsHref && (
            <LinkButton variant="ghost" href={revisionsHref}>
              <FaClock aria-hidden="true" />
              <span className="min-w-0">Working revisions</span>
            </LinkButton>
          )}
          {preview}
          {privateDraft && (
            <a className="btn btn-ghost" href="#private-publication">
              <FaCalendarAlt aria-hidden="true" />
              Publication
            </a>
          )}
          <AdminButton variant="ghost" onClick={onCancelAction}>
            <FaTimes aria-hidden="true" />
            Cancel
          </AdminButton>
          <AdminAsyncButton
            type="submit"
            form="admin-content-editor"
            color="primary"
            className="admin-editor-submit"
            aria-label={saving ? (hu ? "Mentés..." : "Saving...") : submitLabel}
            loading={saving}
            loadingLabel={hu ? "Mentés..." : "Saving..."}
            icon={FaSave}
          >
            {submitLabel}
          </AdminAsyncButton>
        </div>
      </div>
      <div className="admin-action-status">
        <Badge data-content-status={publication.status}>
          {publicationLabels[savedPublicationState(publication)]}
        </Badge>
        <span role="status">
          {privateDraft ? privateSaveStatus(privateDraft) : saveStatus}
        </span>
      </div>
    </div>
  );

  if (headerSlot === undefined) {
    return actions;
  }

  return headerSlot ? createPortal(actions, headerSlot) : null;
}
