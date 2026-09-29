import { SignUpForm } from "@/components/auth/SignUpForm";
import { getOperationalOAuthProviders } from "@/lib/auth/auth-server";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  const providers = await getOperationalOAuthProviders();
  return <SignUpForm providers={providers} />;
}
