"use client";

import Link from "next/link";
import { useId, type PointerEvent } from "react";

import { Tooltip } from "@/ui/primitives/Tooltip/Tooltip";

import { useTextOverflow } from "./useTextOverflow";

export function TruncatedText({
  value,
  href,
  className,
}: {
  value: string;
  href?: string;
  className?: string;
}) {
  const id = useId();
  const { ref, truncated } = useTextOverflow(value);

  function focusOnTouch(event: PointerEvent<HTMLSpanElement>) {
    if (event.pointerType === "touch" && truncated && !href) {
      event.currentTarget.focus({ preventScroll: true });
    }
  }

  const text = (
    <span
      ref={ref}
      className="admin-ellipsis"
      tabIndex={!href && truncated ? 0 : undefined}
      onPointerUp={focusOnTouch}
    >
      {value}
    </span>
  );

  return (
    <Tooltip
      as="span"
      className={
        className
          ? `admin-ellipsis-trigger ${className}`
          : "admin-ellipsis-trigger"
      }
      id={id}
      content={value}
      enabled={truncated}
      touchPreview={Boolean(href)}
    >
      {href ? (
        <Link href={href} className="block min-w-0">
          {text}
        </Link>
      ) : (
        text
      )}
    </Tooltip>
  );
}
