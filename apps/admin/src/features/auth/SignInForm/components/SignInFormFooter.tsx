"use client";

import Link from "next/link";

type SignInFormFooterProps = {
  rememberEmail: boolean;
  onRememberEmailChangeAction: (checked: boolean) => void;
};

export function SignInFormFooter({
  rememberEmail,
  onRememberEmailChangeAction,
}: SignInFormFooterProps) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-1">
        <label className="label min-h-8 cursor-pointer gap-2 px-0 whitespace-normal">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={rememberEmail}
            onChange={(e) => onRememberEmailChangeAction(e.target.checked)}
          />
          <span className="label-text">Remember email</span>
        </label>

        <Link href="/auth/forgot-password" className="link link-hover">
          Forgot password?
        </Link>
      </div>

      <p className="text-center text-sm text-(--text-muted)">
        Don&apos;t have an account yet?{" "}
        <Link href="/auth/sign-up" className="font-semibold link link-primary">
          Sign Up
        </Link>
      </p>
    </>
  );
}
