import { redirect } from "next/navigation";

import {
  MediaAccessDenied,
  MediaLibrary,
} from "@/components/admin/Media/MediaLibrary";
import { getSessionWithRole, hasAnyRole } from "@/lib/auth/session.server";

export default async function AdminMediaRoute() {
  const session = await getSessionWithRole();

  if (!session?.user.id) {
    redirect("/auth/sign-in?callbackUrl=%2Fadmin%2Fmedia");
  }

  if (!hasAnyRole(session.user.role, ["ADMIN", "EDITOR", "AUTHOR"])) {
    return <MediaAccessDenied />;
  }

  return <MediaLibrary />;
}
