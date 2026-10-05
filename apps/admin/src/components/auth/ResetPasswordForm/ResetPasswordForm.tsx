"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { FaUserAlt } from "react-icons/fa";

import { resetPasswordSchema } from "./ResetPasswordForm.validation";
import { fieldErrorsFromIssues } from "../utils/fieldErrors";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { resetPassword } from "@/lib/auth/auth-client";
import { PasswordField } from "@/ui/components";
import { Alert } from "@/ui/primitives";
import { AuthShell } from "@/ui/shell";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const submissionLock = useRef(false);

  const onSubmitAction = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (submissionLock.current || done) return;
    setFieldErrors({});
    setFormError(null);

    const parsed = resetPasswordSchema.safeParse({ token, password, confirm });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromIssues(parsed.error.issues));
      return;
    }

    submissionLock.current = true;
    setLoading(true);
    try {
      const { error } = await resetPassword({
        token,
        newPassword: password,
      });

      if (error) {
        setFormError(error.message || "Reset failed");
        return;
      }

      setDone(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Reset failed";
      setFormError(msg);
    } finally {
      submissionLock.current = false;
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthShell
        title="Invalid reset link"
        description="Missing token. Please request a new reset link."
        icon={<FaUserAlt size={20} />}
      >
        <div className="mt-4 text-center">
          <Link className="link link-hover" href="/auth/forgot-password">
            Request new link
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset password"
      description="Choose a new password."
      icon={<FaUserAlt size={20} />}
      asForm
      onSubmitAction={onSubmitAction}
    >
      <Alert status="error" message={formError} />

      <div className="space-y-4">
        <fieldset disabled={loading || done} className="contents">
        <PasswordField
          id="reset-password"
          name="password"
          label="New password"
          value={password}
          onChangeAction={(value) => {
            setPassword(value);
            setFieldErrors((current) => ({
              ...current,
              password: undefined,
              confirm: current.confirm === "Passwords do not match" ? undefined : current.confirm,
            }));
            setFormError(null);
          }}
          fullWidth
          rounded="lg"
          color="neutral"
          autoComplete="new-password"
          required
          minLength={8}
          error={fieldErrors.password}
        />

        <PasswordField
          id="reset-password-confirm"
          name="confirm"
          label="Confirm password"
          value={confirm}
          onChangeAction={(value) => {
            setConfirm(value);
            setFieldErrors((current) => ({ ...current, confirm: undefined }));
            setFormError(null);
          }}
          fullWidth
          rounded="lg"
          color="neutral"
          autoComplete="new-password"
          required
          minLength={8}
          error={fieldErrors.confirm}
        />

        <AuthSubmitButton type="submit" loading={loading} disabled={loading || done}>
          Update password
        </AuthSubmitButton>

        {done && (
          <div className="alert alert-success" role="status">
            <span>Password updated successfully.</span>
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
