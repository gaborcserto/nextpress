"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { FaUserAlt } from "react-icons/fa";

import { signInSchema, type SignInFormValues } from "./SignInForm.validation";
import SignInFormFooter from "./SignInFormFooter";
import SignInFormOAuthRow, { type Provider } from "./SignInFormOAuthRow";
import { safeCallbackUrl } from "../utils/safeCallbackUrl";
import { signIn } from "@/lib/auth/auth-client";
import { EmailField, PasswordField } from "@/ui/components";
import { Alert, Button } from "@/ui/primitives";
import { AuthShell } from "@/ui/shell";

export default function SignInForm() {
  const [form, setForm] = useState<SignInFormValues>({
    email: "admin@example.com",
    password: "admin123",
  });

  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof SignInFormValues, string>>
  >({});

  const router = useRouter();
  const params = useSearchParams();

  const callbackURL =
    safeCallbackUrl(params.get("callbackUrl") || params.get("redirectTo")) || "/";

  useEffect(() => {
    const errorParam = params.get("error");
    if (errorParam) setErr(errorParam);
  }, [params]);

  const onSubmitAction = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    setErr(null);
    setFieldErrors({});
    setLoading(true);

    const result = signInSchema.safeParse(form);

    if (!result.success) {
      const validationErrors: Partial<Record<keyof SignInFormValues, string>> =
        {};

      for (const issue of result.error.issues) {
        const path = issue.path[0] as keyof SignInFormValues | undefined;
        if (path && !validationErrors[path]) {
          validationErrors[path] = issue.message;
        }
      }

      setFieldErrors(validationErrors);
      setLoading(false);
      return;
    }

    try {
      const { error } = await signIn.email({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        callbackURL,
        rememberMe,
      });

      if (error) {
        setErr(error.message || "Sign in failed");
        return;
      }

      router.push(callbackURL);
    } catch (error) {
      if (error instanceof Error) {
        setErr(error.message);
      } else {
        setErr("Unexpected error");
      }
    } finally {
      setLoading(false);
    }
  };

  const oauth = async (provider: Provider) => {
    await signIn.social({ provider, callbackURL });
  };

  return (
    <AuthShell
      title="Welcome back"
      description="Please enter your details to sign in."
      icon={<FaUserAlt size={20} />}
      asForm
      onSubmitAction={onSubmitAction}
    >
      <Alert status="error" message={err} />

      <SignInFormOAuthRow onProviderAction={oauth} compact />

      <div className="my-4">
        <div className="divider text-xs text-base-content/60">OR</div>
      </div>

      <div className="space-y-4">
        <EmailField
          id="signin-email"
          name="email"
          label="Email"
          value={form.email}
          onChangeAction={(v) => setForm((p) => ({ ...p, email: v }))}
          fullWidth
          rounded="lg"
          color="neutral"
          autoComplete="email"
          error={fieldErrors.email}
        />

        <PasswordField
          id="signin-password"
          name="password"
          label="Password"
          value={form.password}
          onChangeAction={(v) => setForm((p) => ({ ...p, password: v }))}
          fullWidth
          rounded="lg"
          color="neutral"
          autoComplete="current-password"
          error={fieldErrors.password}
        />

        <Button
          type="submit"
          variant="solid"
          color="primary"
          size="md"
          fullWidth
          loading={loading}
          disabled={loading}
          className="mt-4 h-12 rounded-xl bg-linear-to-r from-emerald-400 to-cyan-400 text-white shadow-md hover:brightness-[1.05] transition-all duration-200 border-0"
        >
          Sign in
        </Button>

        <SignInFormFooter
          rememberMe={rememberMe}
          onRememberMeChangeAction={(checked) => setRememberMe(checked)}
        />
      </div>
    </AuthShell>
  );
}
