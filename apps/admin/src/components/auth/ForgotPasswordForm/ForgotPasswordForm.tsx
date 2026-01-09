"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { FaUserAlt } from "react-icons/fa";

import { forgotPasswordSchema } from "./ForgotPasswordForm.validation";
import { requestPasswordReset } from "@/lib/auth/auth-client";
import { EmailField } from "@/ui/components";
import { Button } from "@/ui/primitives";
import { AuthShell } from "@/ui/shell";
import { showToast } from "@/ui/utils";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmitAction = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      showToast(parsed.error.issues[0]?.message ?? "Invalid email", "error");
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset({
        email: email.trim().toLowerCase(),
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      setSent(true);
      showToast("If the email exists, a reset link has been sent.", "success");
    } catch {
      setSent(true);
      showToast("If the email exists, a reset link has been sent.", "success");
    } finally {
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
        <EmailField
          id="forgot-email"
          name="email"
          label="Email"
          value={email}
          onChangeAction={setEmail}
          fullWidth
          rounded="lg"
          color="neutral"
          autoComplete="email"
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
      </div>
    </AuthShell>
  );
}
