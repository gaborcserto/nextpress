"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { FaUserAlt } from "react-icons/fa";

import { forgotPasswordSchema } from "./ForgotPasswordForm.validation";
import { fieldErrorsFromIssues } from "../utils/fieldErrors";
import { requestPasswordReset } from "@/lib/auth/auth-client";
import { EmailField } from "@/ui/components";
import { Button } from "@/ui/primitives";
import { AuthShell } from "@/ui/shell";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
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
    try {
      await requestPasswordReset({
        email: email.trim().toLowerCase(),
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      setSent(true);
    } catch {
      setSent(true);
    } finally {
      submissionLock.current = false;
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Forgot password"
      description="We’ll email you a reset link."
      icon={<FaUserAlt size={20} />}
      asForm
      onSubmitAction={onSubmitAction}
    >
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

        <Button
          type="submit"
          variant="solid"
          color="primary"
          size="md"
          fullWidth
          loading={loading}
          disabled={loading || sent}
          className="mt-2 h-12 rounded-xl bg-linear-to-r from-emerald-400 to-cyan-400 text-white shadow-md hover:brightness-[1.05] transition-all duration-200 border-0"
        >
          Send reset link
        </Button>

        {sent && (
          <div className="alert alert-info">
            <span>Check your inbox (and spam) for the reset link.</span>
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
