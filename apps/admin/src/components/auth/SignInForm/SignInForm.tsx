"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { FaUserAlt } from "react-icons/fa";

import { signInSchema, type SignInFormValues } from "./SignInForm.validation";
import SignInFormFooter from "./SignInFormFooter";
import SignInFormOAuthRow, { type Provider } from "./SignInFormOAuthRow";
import { fieldErrorsFromIssues } from "../utils/fieldErrors";
import { safeCallbackUrl } from "../utils/safeCallbackUrl";
import { signIn } from "@/lib/auth/auth-client";
import { EmailField, PasswordField } from "@/ui/components";
import { Alert, Button } from "@/ui/primitives";
import { AuthShell } from "@/ui/shell";

type SignInFormProps = {
  providers: Provider[];
};

export default function SignInForm({ providers }: SignInFormProps) {
  const [form, setForm] = useState<SignInFormValues>({
    email: "",
    password: "",
  });

  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof SignInFormValues, string>>
  >({});
  const submissionLock = useRef(false);

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
    if (submissionLock.current) return;
    setErr(null);
    setFieldErrors({});

    const result = signInSchema.safeParse(form);

    if (!result.success) {
      setFieldErrors(fieldErrorsFromIssues(result.error.issues));
      return;
    }

    submissionLock.current = true;
    setLoading(true);
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
      submissionLock.current = false;
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

      {providers.length ? (
        <SignInFormOAuthRow
          onProviderAction={oauth}
          providers={providers}
          compact
        />
      ) : null}

      {providers.length ? (
        <div className="my-4">
          <div className="divider text-xs text-base-content/60">OR</div>
        </div>
      ) : null}

      <div className="space-y-4">
        <fieldset disabled={loading} className="contents">
        <EmailField
          id="signin-email"
          name="email"
          label="Email"
          value={form.email}
          onChangeAction={(v) => {
            setForm((p) => ({ ...p, email: v }));
            setErr(null);
            setFieldErrors((current) => ({ ...current, email: undefined }));
          }}
          fullWidth
          rounded="lg"
          color="neutral"
          autoComplete="email"
          error={fieldErrors.email}
          required
        />

        <PasswordField
          id="signin-password"
          name="password"
          label="Password"
          value={form.password}
          onChangeAction={(v) => {
            setForm((p) => ({ ...p, password: v }));
            setErr(null);
            setFieldErrors((current) => ({ ...current, password: undefined }));
          }}
          fullWidth
          rounded="lg"
          color="neutral"
          autoComplete="current-password"
          error={fieldErrors.password}
          required
          minLength={6}
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
        </fieldset>
      </div>
    </AuthShell>
  );
}
