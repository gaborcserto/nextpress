"use client";

import type { UserAvatarProps } from "./UserAvatar.types";

export function UserAvatar({
  name,
  image,
  size = "sm",
  asButton = false,
  className = "",
}: UserAvatarProps) {
  const initial = name?.trim()?.[0]?.toUpperCase() ?? "?";

  // Size classes
  const sizeClass =
      size === "sm"
          ? "w-9 h-9 text-sm" // topbar
          : size === "md"
          ? "w-16 h-16 text-2xl"
          : "w-24 h-24 text-4xl"; // profile

  const wrapper = asButton
      ? `btn btn-ghost btn-circle avatar ${className}`
      : `avatar ${className}`;

  // Background gradient (no image)
  const bgGradient = "bg-gradient-to-br from-primary/90 to-secondary";

  return (
      <div className={wrapper}>
        <div
            className={`rounded-full overflow-hidden grid place-items-center ${sizeClass}
        ${image ? "" : bgGradient}`}
        >
          {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                  src={image}
                  alt={name || "Avatar"}
                  className="w-full h-full object-cover"
              />
          ) : size === "sm" ? (
              // SMALL: gradient text using pure Tailwind
              <span
                  className="
                    font-bold
                    bg-gradient-to-br from-white via-pink-200 to-indigo-300
                    bg-clip-text text-transparent
                    drop-shadow-sm
                  "
              >
                {initial}
              </span>
          ) : (
              // large & medium text is simple white
              <span className="font-semibold text-white">{initial}</span>
          )}
        </div>
      </div>
  );
}

export default UserAvatar;
