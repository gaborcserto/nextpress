import SignInForm from "@/components/auth/SignInForm";
import { getOperationalOAuthProviders } from "@/lib/auth/auth-server";

export const dynamic = "force-dynamic";

export default async function SignInPageRoute() {
  const providers = await getOperationalOAuthProviders();
  return <SignInForm providers={providers} />;
}
