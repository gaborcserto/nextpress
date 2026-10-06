"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { FaUserAlt } from "react-icons/fa";

import { forgotPasswordSchema } from "./ForgotPasswordForm.validation";
import { fieldErrorsFromIssues } from "../utils/fieldErrors";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { requestPasswordReset } from "@/lib/auth/auth-client";
import { EmailField } from "@/ui/components";
import { Alert } from "@/ui/primitives";
import { AuthShell } from "@/ui/shell";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const submissionLock = useRef(false);

  const onSubmitAction = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (submissionLock.current || sent) return;

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldError(fieldErrorsFromIssues(parsed.error.issues).email);
      return;
    }

    submissionLock.current = true;
    setLoading(true);
    setFormError(null);
    try {
      const { error } = await requestPasswordReset({
        email: parsed.data.email,
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        setFormError("Password recovery is unavailable. Contact an administrator.");
        return;
      }
      setSent(true);
    } catch {
      setFormError("Password recovery is unavailable. Contact an administrator.");
    } finally {
      submissionLock.current = false;
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Forgot password"
      description="Password recovery requires email delivery, which is currently unavailable."
      icon={<FaUserAlt size={20} />}
      asForm
      onSubmitAction={onSubmitAction}
    >
      <Alert status="error" message={formError} />
      <div className="space-y-4">
        <fieldset disabled={loading || sent} className="contents">
        <EmailField
          id="forgot-email"
          name="email"
          label="Email"
          value={email}
          onChangeAction={(value) => {
            setEmail(value);
            setFieldError(undefined);
          }}
          fullWidth
          rounded="lg"
          color="neutral"
          autoComplete="email"
          required
          error={fieldError}
        />

        <AuthSubmitButton type="submit" loading={loading} disabled={loading || sent}>
          Send reset link
        </AuthSubmitButton>

        {sent && (
          <div className="alert alert-info" role="status">
            <span>If this account is eligible, check your inbox for a reset link.</span>
          </div>
        )}

        <p className="text-sm text-center">
          <Link className="link link-hover" href="/auth/sign-in">
            Back to sign in
          </Link>
        </p>
        </fieldset>
      </div>
    </AuthShell>
  );
}
