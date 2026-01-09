"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, type FormEvent } from "react";
import { FaUserAlt } from "react-icons/fa";

import { signUpSchema } from "./SignUpForm.validation";
import SignInFormOAuthRow, { type Provider } from "@/components/auth/SignInForm/SignInFormOAuthRow";
import { safeCallbackUrl } from "@/components/auth/utils/safeCallbackUrl";
import { signIn, signUp } from "@/lib/auth/auth-client";
import { EmailField, PasswordField } from "@/ui/components";
import { Button, Input } from "@/ui/primitives";
import { AuthShell } from "@/ui/shell";
import { showToast } from "@/ui/utils";

export function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const params = useSearchParams();

  const callbackURL =
    safeCallbackUrl(params.get("callbackUrl") || params.get("redirectTo")) || "/";

  const oauth = useCallback(
    async (provider: Provider) => {
      await signIn.social({ provider, callbackURL });
    },
    [callbackURL]
  );

  const onSubmitAction = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();

    const parsed = signUpSchema.safeParse({ email, password, name });
    if (!parsed.success) {
      showToast(parsed.error.issues[0]?.message ?? "Invalid form", "error");
      return;
    }

    setLoading(true);
    try {
      const safeName = name.trim() || email.split("@")[0];

      const { error } = await signUp.email({
        email: email.trim().toLowerCase(),
        password,
        name: safeName,
        callbackURL,
      });

      if (error) {
        showToast(error.message || "Sign up failed", "error");
        return;
      }

      showToast("Account created. You can sign in now.", "success");
      router.push(`/auth/sign-in?callbackUrl=${encodeURIComponent(callbackURL)}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign up failed";
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create account"
      description="Sign up to access the admin."
      icon={<FaUserAlt size={20} />}
      asForm
      onSubmitAction={onSubmitAction}
    >
      <SignInFormOAuthRow onProviderAction={oauth} compact />

      <div className="my-4">
        <div className="divider text-xs text-base-content/60">OR</div>
      </div>

      <div className="space-y-4">
        <Input
          id="signup-name"
          name="name"
          label="Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          rounded="lg"
          color="neutral"
          autoComplete="name"
        />

        <EmailField
          id="signup-email"
          name="email"
          label="Email"
          value={email}
          onChangeAction={setEmail}
          fullWidth
          rounded="lg"
          color="neutral"
          autoComplete="email"
        />

        <PasswordField
          id="signup-password"
          name="password"
          label="Password"
          value={password}
          onChangeAction={setPassword}
          fullWidth
          rounded="lg"
          color="neutral"
          autoComplete="new-password"
        />

        <Button
          type="submit"
          variant="solid"
          color="primary"
          size="md"
          fullWidth
          loading={loading}
          disabled={loading}
          className="mt-2 h-12 rounded-xl bg-linear-to-r from-emerald-400 to-cyan-400 text-white shadow-md hover:brightness-[1.05] transition-all duration-200 border-0"
        >
          Sign up
        </Button>

        <p className="text-sm text-center">
          Already have an account?{" "}
          <Link
            className="link link-hover"
            href={`/auth/sign-in?callbackUrl=${encodeURIComponent(callbackURL)}`}
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
