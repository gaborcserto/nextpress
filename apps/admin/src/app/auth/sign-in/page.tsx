import { redirect } from "next/navigation";

import SignInForm from "@/components/auth/SignInForm";
import { getOperationalOAuthProviders, getSessionWithRole } from "@/lib/auth/auth-server";

export const dynamic = "force-dynamic";

export default async function SignInPageRoute() {
  if ((await getSessionWithRole())?.user.id) redirect("/admin");

  const providers = await getOperationalOAuthProviders();
  return <SignInForm providers={providers} />;
}
