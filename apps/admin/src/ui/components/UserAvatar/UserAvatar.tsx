"use client";

import Avatar from "boring-avatars";
import { useMemo, useState } from "react";

import type { UserAvatarProps } from "./UserAvatar.types";
import { normalizeAvatarUrl } from "./UserAvatar.utils";

export function UserAvatar({
  name,
  image,
  size = "sm",
  asButton = false,
  className = ""
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);

  const seed = (name?.trim() || "user").toLowerCase();
  const px = size === "sm" ? 36 : size === "md" ? 64 : 96;

  const sizeClass =
      size === "sm"
          ? "w-9 h-9 text-sm" // topbar
          : size === "md"
          ? "w-16 h-16 text-2xl"
          : "w-24 h-24 text-4xl"; // profile

  const wrapper = asButton
    ? `btn btn-ghost btn-circle avatar ${className}`
    : `avatar ${className}`;

  const src = useMemo(() => (image ? normalizeAvatarUrl(image, px) : null), [image, px]);

  return (
    <div className={wrapper}>
      <div className={`rounded-full overflow-hidden ${sizeClass}`}>
        {src && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={name ? `${name} avatar` : "Avatar"}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
          />
        ) : (
          <Avatar
            size={px}
            name={seed}
            variant="beam"
            colors={["#0A0310", "#49007E", "#FF005B", "#FF7D10", "#FFB238"]}
          />
        )}
      </div>
    </div>
  );
}

export default UserAvatar;
