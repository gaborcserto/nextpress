import { redirect } from "next/navigation";

import DashboardScreen from "@/features/dashboard/DashboardScreen/DashboardScreen";
import { getSessionWithRole } from "@/lib/auth/session.server";

export default async function DashboardPage() {
  const session = await getSessionWithRole();

  if (!session?.user?.id) {
    redirect("/auth/sign-in?callbackUrl=%2Fadmin");
  }

  const { id, name, role } = session.user;

  return <DashboardScreen account={{ id, name, role }} />;
}
