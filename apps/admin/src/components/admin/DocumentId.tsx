"use client";

import { useId, useState } from "react";
import { FaCopy } from "react-icons/fa";

import { IconButton, Tooltip } from "@/ui/primitives";
import { showToast } from "@/ui/utils";

export default function DocumentId({ id }: { id: string }) {
  const tooltipId = useId();
  const [tooltipOpen, setTooltipOpen] = useState(false);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(id);
      showToast("Document ID copied.");
    } catch {
      showToast("Unable to copy document ID.", "error");
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-2 text-xs text-(--text-muted)">
      <span className="min-w-0 flex-1 text-right">
        ID: <span className="break-all font-mono">{id}</span>
      </span>
      <Tooltip
        id={tooltipId}
        content="Copy document ID"
        onOpenChange={setTooltipOpen}
      >
        <IconButton
          icon={FaCopy}
          size="xs"
          variant="ghost"
          aria-label="Copy document ID"
          aria-describedby={tooltipOpen ? tooltipId : undefined}
          onClick={() => void copyId()}
        />
      </Tooltip>
    </div>
  );
}
