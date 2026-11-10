"use client";

import Avatar from "boring-avatars";
import { useState } from "react";

import { safeImageUrl } from "@/lib/security/image-url";

import type { UserAvatarProps } from "./UserAvatar.types";
import { normalizeAvatarUrl } from "./UserAvatar.utils";

const avatarSizes = {
  sm: { pixels: 36, className: "w-9 h-9 text-sm" },
  md: { pixels: 64, className: "w-16 h-16 text-2xl" },
  lg: { pixels: 96, className: "w-24 h-24 text-4xl" },
};

export function UserAvatar({
  name,
  image,
  size = "sm",
  asButton = false,
  className = "",
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);

  const seed = (name?.trim() || "user").toLowerCase();
  const { pixels: px, className: sizeClass } = avatarSizes[size];

  const wrapper = asButton
    ? `btn btn-ghost btn-circle avatar ${className}`
    : `avatar ${className}`;

  const safeImage = image ? safeImageUrl(image) : null;
  const src = safeImage ? normalizeAvatarUrl(safeImage, px) : null;

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
