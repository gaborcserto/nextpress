"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useRef, type FormEvent } from "react";
import { FaUserAlt } from "react-icons/fa";

import { signUpSchema, type SignUpFormValues } from "./SignUpForm.validation";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import SignInFormOAuthRow, { type Provider } from "@/components/auth/SignInForm/SignInFormOAuthRow";
import { fieldErrorsFromIssues } from "@/components/auth/utils/fieldErrors";
import { safeCallbackUrl } from "@/components/auth/utils/safeCallbackUrl";
import { signIn, signUp } from "@/lib/auth/auth-client";
import { EmailField, PasswordField } from "@/ui/components";
import { Alert, Input } from "@/ui/primitives";
import { AuthShell } from "@/ui/shell";
import { showToast } from "@/ui/utils";

type SignUpFormProps = {
  providers: Provider[];
};

export function SignUpForm({ providers }: SignUpFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof SignUpFormValues, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const submissionLock = useRef(false);

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
    if (submissionLock.current) return;
    setFieldErrors({});
    setFormError(null);

    const parsed = signUpSchema.safeParse({ email, password, name });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromIssues(parsed.error.issues));
      return;
    }

    submissionLock.current = true;
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
        setFormError(error.message || "Sign up failed");
        return;
      }

      showToast("Account created. You can sign in now.", "success");
      router.push(`/auth/sign-in?callbackUrl=${encodeURIComponent(callbackURL)}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign up failed";
      setFormError(msg);
    } finally {
      submissionLock.current = false;
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
      <Alert status="error" message={formError} />

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
        <Input
          id="signup-name"
          name="name"
          label="Name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setFormError(null);
            setFieldErrors((current) => ({ ...current, name: undefined }));
          }}
          fullWidth
          rounded="lg"
          color="neutral"
          autoComplete="name"
          minLength={2}
          maxLength={64}
          error={fieldErrors.name}
        />

        <EmailField
          id="signup-email"
          name="email"
          label="Email"
          value={email}
          onChangeAction={(value) => {
            setEmail(value);
            setFormError(null);
            setFieldErrors((current) => ({ ...current, email: undefined }));
          }}
          fullWidth
          rounded="lg"
          color="neutral"
          autoComplete="email"
          required
          error={fieldErrors.email}
        />

        <PasswordField
          id="signup-password"
          name="password"
          label="Password"
          value={password}
          onChangeAction={(value) => {
            setPassword(value);
            setFormError(null);
            setFieldErrors((current) => ({ ...current, password: undefined }));
          }}
          fullWidth
          rounded="lg"
          color="neutral"
          autoComplete="new-password"
          required
          minLength={8}
          error={fieldErrors.password}
        />

        <AuthSubmitButton type="submit" loading={loading} disabled={loading}>
          Sign up
        </AuthSubmitButton>

        <p className="text-sm text-center">
          Already have an account?{" "}
          <Link
            className="link link-hover"
            href={`/auth/sign-in?callbackUrl=${encodeURIComponent(callbackURL)}`}
          >
            Sign in
          </Link>
        </p>
        </fieldset>
      </div>
    </AuthShell>
  );
}
