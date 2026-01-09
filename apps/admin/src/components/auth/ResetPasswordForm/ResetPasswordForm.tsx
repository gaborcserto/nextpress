"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { FaUserAlt } from "react-icons/fa";

import { resetPasswordSchema } from "./ResetPasswordForm.validation";
import { resetPassword } from "@/lib/auth/auth-client";
import { PasswordField } from "@/ui/components";
import { Button } from "@/ui/primitives";
import { AuthShell } from "@/ui/shell";
import { showToast } from "@/ui/utils";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmitAction = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();

    const parsed = resetPasswordSchema.safeParse({ token, password, confirm });
    if (!parsed.success) {
      showToast(parsed.error.issues[0]?.message ?? "Invalid form", "error");
      return;
    }

    setLoading(true);
    try {
      const { error } = await resetPassword({
        token,
        newPassword: password,
      });

      if (error) {
        showToast(error.message || "Reset failed", "error");
        return;
      }

      setDone(true);
      showToast("Password updated. You can sign in now.", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Reset failed";
      showToast(msg, "error");
    } finally {
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
      <div className="space-y-4">
        <PasswordField
          id="reset-password"
          name="password"
          label="New password"
          value={password}
          onChangeAction={setPassword}
          fullWidth
          rounded="lg"
          color="neutral"
          autoComplete="new-password"
        />

        <PasswordField
          id="reset-password-confirm"
          name="confirm"
          label="Confirm password"
          value={confirm}
          onChangeAction={setConfirm}
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
          Update password
        </Button>

        {done && (
          <div className="alert alert-success">
            <span>Password updated successfully.</span>
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
