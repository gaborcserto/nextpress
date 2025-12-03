"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { FaUserAlt } from "react-icons/fa";
import { ValidationError } from "yup";

import {
  signInSchema,
  type SignInFormValues,
} from "./SignInForm.validation";
import SignInFormFooter from "./SignInFormFooter";
import SignInFormOAuthRow, { type Provider } from "./SignInFormOAuthRow";
import { safeCallbackUrl } from "../utils/safeCallbackUrl";
import { signIn } from "@/lib/auth";
import Alert from "@/ui/components/Alert";
import { Button } from "@/ui/components/Buttons";
import Input from "@/ui/components/Input";

/* ------------------ Component ------------------ */

export default function SignInForm() {
  const [form, setForm] = useState<SignInFormValues>({
    email: "admin@example.com",
    password: "admin123",
  });

  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof SignInFormValues, string>>
  >({});

  const router = useRouter();
  const params = useSearchParams();

  const callbackURL =
    safeCallbackUrl(
      params.get("callbackUrl") || params.get("redirectTo")
    ) || "/";

  /* --------------- Load auth errors passed in URL --------------- */

  useEffect(() => {
    const errorParam = params.get("error");
    if (errorParam) setErr(errorParam);
  }, [params]);

  /* ------------------ Universal Change Handler ------------------ */

  const handleFormChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, type, value, checked } = e.target;

    // update text fields
    if (type !== "checkbox") {
      setForm((prev) => ({
        ...prev,
        [name]: value,
      }));
    }

    // update checkbox
    if (type === "checkbox" && name === "rememberMe") {
      setRememberMe(checked);
    }

    // clear field error on change
    if (fieldErrors[name as keyof SignInFormValues]) {
      setFieldErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  /* ------------------ Submit Handler ------------------ */

  const onSubmit = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    setErr(null);
    setFieldErrors({});
    setLoading(true);

    try {
      await signInSchema.validate(form, { abortEarly: false });

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
      if (error instanceof ValidationError) {
        const validationErrors: Partial<Record<keyof SignInFormValues, string>> =
          {};

        error.inner.forEach((err) => {
          const path = err.path as keyof SignInFormValues;
          if (path && !validationErrors[path]) {
            validationErrors[path] = err.message;
          }
        });

        setFieldErrors(validationErrors);
      } else if (error instanceof Error) {
        setErr(error.message);
      } else {
        setErr("Unexpected error");
      }
    } finally {
      setLoading(false);
    }
  };

  /* ------------------ OAuth ------------------ */

  const oauth = async (provider: Provider) => {
    await signIn.social({
      provider,
      callbackURL,
    });
  };

  /* ------------------ Render ------------------ */

  return (
    <div className="min-h-dvh grid place-items-center px-4 bg-gradient-to-br from-base-200 to-base-300">
      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-md rounded-3xl border border-base-300 bg-base-100 shadow-xl overflow-hidden"
      >
        <div className="p-6 sm:p-8">
          {/* Avatar Icon */}
          <div className="flex justify-center mb-4">
            <div className="size-16 rounded-full bg-gradient-to-br from-primary/90 to-secondary text-primary-content grid place-items-center shadow-md">
              <FaUserAlt size={20} />
            </div>
          </div>

          {/* Header */}
          <h1 className="text-center text-2xl font-semibold">Welcome back</h1>
          <p className="text-center text-sm text-base-content/70 mt-1 mb-5">
            Please enter your details to sign in.
          </p>

          {/* Auth errors (from URL or API) */}
          <Alert status="error" message={err} />

          {/* OAuth providers */}
          <SignInFormOAuthRow onProviderAction={oauth} compact />

          <div className="my-4">
            <div className="divider text-xs text-base-content/60">OR</div>
          </div>

          {/* Form fields */}
          <div className="space-y-4">
            <Input
              id="signin-email"
              name="email"
              label="Email"
              type="email"
              value={form.email}
              onChange={handleFormChange}
              fullWidth
              rounded="lg"
              color="neutral"
              autoComplete="email"
              error={fieldErrors.email}
            />

            <Input
              id="signin-password"
              name="password"
              label="Password"
              type="password"
              value={form.password}
              onChange={handleFormChange}
              fullWidth
              rounded="lg"
              color="neutral"
              autoComplete="current-password"
              error={fieldErrors.password}
            />

            {/* Submit Button */}
            <Button
              type="submit"
              variant="solid"
              color="primary"
              size="md"
              fullWidth
              loading={loading}
              disabled={loading}
              className="mt-4 h-12 rounded-xl bg-gradient-to-r from-primary to-secondary text-white shadow-md hover:brightness-[1.05] transition-all duration-200 border-0"
            >
              Sign in
            </Button>

            <SignInFormFooter
              rememberMe={rememberMe}
              onRememberMeChangeAction={(checked) => setRememberMe(checked)}
            />
          </div>
        </div>
      </form>
    </div>
  );
}
