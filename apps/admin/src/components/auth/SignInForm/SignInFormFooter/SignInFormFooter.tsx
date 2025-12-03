"use client";

import Link from "next/link";

import type { SignInFormFooterProps } from "./SignInFormFooter.types";

export function SignInFormFooter({
  rememberMe,
  onRememberMeChangeAction,
}: SignInFormFooterProps) {
  return (
    <>
      <div className="flex items-center justify-between pt-1">
        {/* Remember Me */}
        <label className="label cursor-pointer gap-2 px-0">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={rememberMe}
            onChange={(e) => onRememberMeChangeAction(e.target.checked)}
          />
          <span className="label-text">Remember me</span>
        </label>

        {/* Forgot password */}
        <Link href="/auth/forgot-password" className="link link-hover">
          Forgot password?
        </Link>
      </div>

      {/* Sign Up link */}
      <p className="text-center mt-5 text-sm text-base-content/70">
        Don&apos;t have an account yet?{" "}
        <Link href="/auth/sign-up" className="font-semibold link link-primary">
          Sign Up
        </Link>
      </p>
    </>
  );
}

export default SignInFormFooter;
