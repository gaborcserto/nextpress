// Design system shared theme

export type UiColor =
  | "default"
  | "primary"
  | "secondary"
  | "accent"
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "error";

export type UiSize = "xs" | "sm" | "md" | "lg" | "xl";

export type UiRadius = "none" | "sm" | "md" | "lg" | "xl" | "full";

// Generic status (can be used by Alert, Badge, etc.)
export type UiStatus = "success" | "error" | "warning" | "info";

export type UiVariantBase = "solid" | "ghost";

// Button-specific variants (extends base)
export type ButtonVariant =
  | UiVariantBase
  | "outline"
  | "link"
  | "soft"
  | "dashed";

// Input-specific variants (only base)
export type InputVariant = UiVariantBase;

// Gradient variants
export type GradientVariant =
  | "yellow-pink"
  | "blue-light"
  | "pink-fuchsia"
  | "cyan-blue"
  | "green-lime"
  | "pink-orange"
  | "teal-cyan"
  | "yellow-orange"
  | "purple-indigo"
  | "orange-pink"
  | "sky-lavender"
  | "teal-blue";

// Avatar uses only sm/md/lg from UiSize
export type AvatarSize = Extract<UiSize, "sm" | "md" | "lg">;
