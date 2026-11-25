import type { ReactNode } from "react";

export type SectionProps = {
  title: string;
  desc?: string;
  headerAside?: ReactNode;
  children: ReactNode;
  className?: string;
  variant?: "soft" | "plain";
};
