import { redirect } from "next/navigation";

import {
  MediaAccessDenied,
  MediaLibrary,
} from "@/components/admin/Media/MediaLibrary";
import { getSessionWithRole, hasAnyRole } from "@/lib/auth/session.server";

export default async function AdminDocumentsRoute() {
  const session = await getSessionWithRole();

  if (!session?.user.id) {
    redirect("/auth/sign-in?callbackUrl=%2Fadmin%2Fdocuments");
  }

  if (!hasAnyRole(session.user.role, ["ADMIN", "EDITOR", "AUTHOR"])) {
    return <MediaAccessDenied />;
  }

  return <MediaLibrary documents />;
}
