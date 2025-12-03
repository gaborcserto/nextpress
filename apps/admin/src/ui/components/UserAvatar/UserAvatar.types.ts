import type { AvatarSize } from "@/ui/theme/types";

export type UserAvatarProps = {
  name?: string | null;
  image?: string | null;
  size?: AvatarSize;
  asButton?: boolean;
  className?: string;
};
