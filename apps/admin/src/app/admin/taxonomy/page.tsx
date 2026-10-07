import { redirect } from "next/navigation";

import TaxonomyScreen from "@/components/admin/TaxonomyScreen";
import { getSessionWithRole, hasAnyRole } from "@/lib/auth/auth-server";

export default async function AdminTaxonomyRoute() {
  const session = await getSessionWithRole();
  if (!session?.user?.id) {
    redirect("/auth/sign-in?callbackUrl=%2Fadmin%2Ftaxonomy");
  }
  if (!hasAnyRole(session.user.role, ["ADMIN", "EDITOR", "AUTHOR"])) {
    return <div role="alert">You do not have permission to manage tags.</div>;
  }
  return <TaxonomyScreen />;
}
