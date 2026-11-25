import { notFound } from "next/navigation";

import { UserEditScreen } from "@/components/admin/UsersScreen/UserEditScreen";
import { getSessionWithRole } from "@/lib/auth/session.server";

export default async function UserEditPage({
  params,
}: PageProps<"/admin/users/[id]/edit">) {
  const session = await getSessionWithRole();
  const { id } = await params;

  if (session?.user.role !== "ADMIN" || !id || id.length > 64) {
    notFound();
  }

  return <UserEditScreen id={id} />;
}
