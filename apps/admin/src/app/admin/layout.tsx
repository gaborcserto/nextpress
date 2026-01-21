import { getSessionWithRole } from "@/lib/auth/auth-server";
import { AppShell } from "@/ui/shell";
import type { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSessionWithRole();
  const role = session?.user?.role ?? null;

  return <AppShell role={role}>{children}</AppShell>;
}
