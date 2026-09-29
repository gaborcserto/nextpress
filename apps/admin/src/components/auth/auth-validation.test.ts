import { describe, expect, it } from "vitest";

import { forgotPasswordSchema } from "./ForgotPasswordForm/ForgotPasswordForm.validation";
import { resetPasswordSchema } from "./ResetPasswordForm/ResetPasswordForm.validation";
import { signInSchema } from "./SignInForm/SignInForm.validation";
import { signUpSchema } from "./SignUpForm/SignUpForm.validation";

describe("authentication form validation", () => {
  it("requires a valid email and a six-character sign-in password", () => {
    expect(signInSchema.safeParse({ email: "user@example.com", password: "secret" }).success).toBe(true);
    expect(signInSchema.safeParse({ email: "invalid", password: "secret" }).success).toBe(false);
    expect(signInSchema.safeParse({ email: "user@example.com", password: "short" }).success).toBe(false);
  });

  it("allows an omitted or empty display name during sign-up", () => {
    expect(
      signUpSchema.safeParse({
        email: "user@example.com",
        password: "password",
      }).success
    ).toBe(true);
    expect(
      signUpSchema.safeParse({
        name: "A",
        email: "user@example.com",
        password: "password",
      }).success
    ).toBe(false);
  });

  it("validates forgot-password email input", () => {
    expect(forgotPasswordSchema.safeParse({ email: "user@example.com" }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });

  it("requires matching reset passwords and a non-empty token", () => {
    expect(
      resetPasswordSchema.safeParse({
        token: "token",
        password: "password",
        confirm: "password",
      }).success
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({
        token: "",
        password: "password",
        confirm: "different",
      }).success
    ).toBe(false);
  });
});
