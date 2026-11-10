import type { IconType } from "react-icons";

import type { RoleName } from "@/lib/auth/roles";

export type NavConfig = {
  href: string;
  label: string;
  icon: IconType;
};

export type SidebarProps = {
  collapsed: boolean;
  role: RoleName | null;
  onItemClickAction?: () => void;
  onCloseAction?: () => void;
  onToggleCollapsedAction?: () => void;
};
