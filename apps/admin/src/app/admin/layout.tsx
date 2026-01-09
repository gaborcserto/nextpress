import { AppShell } from "@/ui/shell";
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
      <AppShell>{children}</AppShell>
  );
}
