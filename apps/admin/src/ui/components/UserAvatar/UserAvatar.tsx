"use client";

import { useState } from "react";

import { safeImageUrl } from "@/lib/security/image-url";

import { normalizeAvatarUrl } from "./UserAvatar.utils";

import type { UserAvatarProps } from "./UserAvatar.types";

const avatarSizes = {
  sm: { pixels: 36, className: "size-9 text-xs" },
  md: { pixels: 64, className: "size-16 text-xl" },
  lg: { pixels: 96, className: "size-24 text-3xl" },
};

function initials(name?: string | null) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const first = parts[0];
  const last = parts.length > 1 ? parts.at(-1) : undefined;

  return first
    ? [first, last]
        .map((part) => Array.from(part ?? "")[0] ?? "")
        .join("")
        .toUpperCase()
    : "?";
}

export function UserAvatar({
  name,
  image,
  size = "sm",
  className = "",
}: UserAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const { pixels, className: sizeClass } = avatarSizes[size];
  const safeImage = image ? safeImageUrl(image) : null;
  const src = safeImage ? normalizeAvatarUrl(safeImage, pixels) : null;
  const accessibleName = name?.trim()
    ? `${name.trim()} avatar`
    : "Account avatar";

  return (
    <span
      role="img"
      aria-label={accessibleName}
      className={`admin-avatar ${sizeClass} ${className}`}
    >
      {src && failedSrc !== src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="size-full rounded-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </span>
  );
}

export default UserAvatar;
