"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { PublicationStatusBadge } from "@/ui/components/PublicationStatusBadge";
import { Tooltip } from "@/ui/primitives";

import styles from "./MenuPageOption.module.css";

import type { PublicationState } from "@/lib/content/publication-status";

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
  const titleRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const tooltipId = `menu-page-title-tooltip-${id}`;

  const measureTitleOverflow = useCallback(() => {
    const titleElement = titleRef.current;

    if (!titleElement) {
      return;
    }

    const isTitleTruncated =
      titleElement.scrollWidth > titleElement.clientWidth;

    setIsTruncated(isTitleTruncated);

    if (!isTitleTruncated) {
      setIsTooltipOpen(false);
    }
  }, []);

  useLayoutEffect(() => {
    const titleElement = titleRef.current;

    if (!titleElement) {
      return;
    }

    measureTitleOverflow();

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measureTitleOverflow);
    resizeObserver?.observe(titleElement);
    window.addEventListener("resize", measureTitleOverflow);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measureTitleOverflow);
    };
  }, [measureTitleOverflow, title]);

  return (
    <Tooltip
      id={tooltipId}
      content={title}
      enabled={isTruncated}
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
        <span
          ref={titleRef}
          className="block min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
        >
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
