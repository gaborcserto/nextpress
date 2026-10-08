import { redirect } from "next/navigation";

import { getSessionWithRole } from "@/lib/auth/auth-server";
import { AppShell } from "@/ui/shell";
import type { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSessionWithRole();
  if (!session?.user?.id) {
    redirect("/auth/sign-in?callbackUrl=%2Fadmin");
  }
  const role = session.user.role;

  return <AppShell role={role}>{children}</AppShell>;
}
