import type { ReactNode } from "react";

export type SectionProps = {
  title: string;
  desc?: string;
  children: ReactNode;
  className?: string;
  variant?: "soft" | "plain";
};
