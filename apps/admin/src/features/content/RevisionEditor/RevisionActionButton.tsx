import { useState } from "react";
import { FaEye, FaUndo } from "react-icons/fa";

import { AdminIconButton, Tooltip } from "@/ui/primitives";

import type {
  RevisionRecord,
  SavedRevisionAction,
} from "./RevisionEditor.types";

export function RevisionActionButton({
  revision,
  action,
  disabled,
  onAction,
}: {
  revision: RevisionRecord;
  action: SavedRevisionAction;
  disabled: boolean;
  onAction: (action: SavedRevisionAction, revisionId: string) => void;
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const tooltipId = `revision-${action}-${revision.id}`;
  const label = action === "preview" ? "Preview revision" : "Restore revision";

  return (
    <Tooltip id={tooltipId} content={label} onOpenChange={setTooltipOpen}>
      <AdminIconButton
        aria-label={`${label} ${revision.workingVersion}`}
        aria-describedby={tooltipOpen ? tooltipId : undefined}
        icon={action === "preview" ? FaEye : FaUndo}
        size="sm"
        variant={action === "preview" ? "soft" : "outline"}
        color={action === "preview" ? "info" : "neutral"}
        disabled={disabled}
        onClick={() => onAction(action, revision.id)}
      />
    </Tooltip>
  );
}
