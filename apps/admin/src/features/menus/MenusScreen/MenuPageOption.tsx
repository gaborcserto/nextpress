"use client";

import { useState } from "react";

import { PublicationStatusBadge } from "@/features/content/publication/PublicationStatusBadge";
import { useTextOverflow } from "@/ui/components/TruncatedText/useTextOverflow";
import { Tooltip } from "@/ui/primitives";

import styles from "./MenuPageOption.module.css";

import type { PublicationState } from "@/features/content/publication/publication-status";

export function MenuPageOption({
  id,
  title,
  checked,
  status,
  systemPage = false,
  onCheckedChange,
}: {
  id: string;
  title: string;
  checked: boolean;
  status?: PublicationState;
  systemPage?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const { ref: titleRef, truncated } = useTextOverflow(title);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const tooltipId = `menu-page-title-tooltip-${id}`;

  return (
    <Tooltip
      id={tooltipId}
      content={title}
      enabled={truncated}
      touchPreview
      onOpenChange={setIsTooltipOpen}
    >
      <label
        className={`${styles.pageOption} flex min-h-10 min-w-0 cursor-pointer items-center gap-2 py-1.5 text-sm leading-5`}
      >
        <input
          type="checkbox"
          className="checkbox checkbox-sm shrink-0"
          checked={checked}
          aria-describedby={isTooltipOpen ? tooltipId : undefined}
          onChange={(event) => onCheckedChange(event.target.checked)}
        />
        <span ref={titleRef} className="admin-ellipsis flex-1">
          {title}
        </span>
        {systemPage && (
          <span className="admin-badge admin-badge-info shrink-0">
            System page
          </span>
        )}
        {status && <PublicationStatusBadge status={status} />}
      </label>
    </Tooltip>
  );
}
