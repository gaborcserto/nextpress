"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";

import { Tooltip } from "@/ui/primitives";

export function ContentListTitle({
  id,
  href,
  title,
}: {
  id: string;
  href: string;
  title: string;
}) {
  const titleRef = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);
  const tooltipId = `content-list-title-${id}`;

  useLayoutEffect(() => {
    const titleElement = titleRef.current;

    if (!titleElement) {
      return;
    }

    const measureTruncation = () => {
      const nextTruncated = titleElement.scrollWidth > titleElement.clientWidth;

      setTruncated((current) =>
        current === nextTruncated ? current : nextTruncated,
      );
    };

    measureTruncation();

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measureTruncation);
    resizeObserver?.observe(titleElement);
    window.addEventListener("resize", measureTruncation);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measureTruncation);
    };
  }, [title]);

  return (
    <Tooltip id={tooltipId} content={title} enabled={truncated}>
      <Link href={href} className="block min-w-0 max-w-[32rem] font-semibold">
        <span ref={titleRef} className="block max-w-full truncate">
          {title}
        </span>
      </Link>
    </Tooltip>
  );
}
