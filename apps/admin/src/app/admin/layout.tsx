import AppShell from "@/ui/layout/AppShell";
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
      <AppShell>{children}</AppShell>
  );
}
