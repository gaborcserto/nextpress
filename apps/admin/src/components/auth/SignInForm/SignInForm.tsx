"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { FaUserAlt } from "react-icons/fa";

import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { signIn } from "@/lib/auth/auth-client";
import { EmailField, PasswordField } from "@/ui/components";
import { Alert } from "@/ui/primitives";
import { AuthShell } from "@/ui/shell";

import { signInSchema, type SignInFormValues } from "./SignInForm.validation";
import SignInFormFooter from "./SignInFormFooter";
import SignInFormOAuthRow, { type Provider } from "./SignInFormOAuthRow";
import { mapNextAuthError } from "../utils/errorMap";
import { fieldErrorsFromIssues } from "../utils/fieldErrors";
import { safeCallbackUrl } from "../utils/safeCallbackUrl";

type SignInFormProps = {
  providers: Provider[];
};

const rememberedEmailKey = "nextpress.admin.remembered-email";

function subscribeToRememberedEmail(onChange: () => void) {
  window.addEventListener("storage", onChange);

  return () => window.removeEventListener("storage", onChange);
}

function readRememberedEmail() {
  try {
    const email = signInSchema.shape.email.safeParse(
      window.localStorage.getItem(rememberedEmailKey),
    );

    return email.success ? email.data : null;
  } catch {
    return null;
  }
}

function signInErrorMessage(status?: number, code?: string): string {
  if (status === 429 || code === "TOO_MANY_REQUESTS") {
    return "Too many sign-in attempts. Please wait a minute before trying again.";
  }

  if (status === 401 || code === "INVALID_EMAIL_OR_PASSWORD") {
    return "Invalid email or password.";
  }

  return "Sign in failed. Please try again.";
}

export default function SignInForm({ providers }: SignInFormProps) {
  const rememberedEmail = useSyncExternalStore(
    subscribeToRememberedEmail,
    readRememberedEmail,
    () => null,
  );
  const [fields, setFields] = useState<Partial<SignInFormValues>>({});
  const form: SignInFormValues = {
    email: fields.email ?? rememberedEmail ?? "",
    password: fields.password ?? "",
  };
  const [rememberOverride, setRememberOverride] = useState<boolean | null>(
    null,
  );
  const rememberEmail = rememberOverride ?? rememberedEmail !== null;
  const [loading, setLoading] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof SignInFormValues, string>>
  >({});
  const submissionLock = useRef(false);

  const router = useRouter();
  const params = useSearchParams();

  const callbackURL =
    safeCallbackUrl(params.get("callbackUrl") || params.get("redirectTo")) ||
    "/";

  const errorParam = params.get("error");
  const [previousErrorParam, setPreviousErrorParam] = useState(errorParam);
  const [err, setErr] = useState(() =>
    errorParam ? mapNextAuthError(errorParam) : null,
  );

  if (previousErrorParam !== errorParam) {
    setPreviousErrorParam(errorParam);

    if (errorParam) {
      setErr(mapNextAuthError(errorParam));
    }
  }

  useEffect(() => {
    try {
      if (
        window.localStorage.getItem(rememberedEmailKey) !== null &&
        readRememberedEmail() === null
      ) {
        window.localStorage.removeItem(rememberedEmailKey);
      }
    } catch {
      // Browser storage can be unavailable; sign-in remains usable without it.
    }
  }, []);

  const onSubmitAction = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();

    if (submissionLock.current) {
      return;
    }

    setErr(null);
    setFieldErrors({});

    const result = signInSchema.safeParse(form);

    if (!result.success) {
      setFieldErrors(fieldErrorsFromIssues(result.error.issues));

      return;
    }

    submissionLock.current = true;
    setLoading(true);

    try {
      const { error } = await signIn.email({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        callbackURL,
      });

      if (error) {
        setErr(signInErrorMessage(error.status, error.code));

        return;
      }

      try {
        if (rememberEmail) {
          window.localStorage.setItem(
            rememberedEmailKey,
            result.data.email.trim().toLowerCase(),
          );
        } else {
          window.localStorage.removeItem(rememberedEmailKey);
        }
      } catch {
        // Remembering email is optional and must not affect authentication.
      }

      router.push(callbackURL);
    } catch {
      setErr("Unable to sign in. Please check your connection and try again.");
    } finally {
      submissionLock.current = false;
      setLoading(false);
    }
  };

  const oauth = async (provider: Provider) => {
    await signIn.social({ provider, callbackURL });
  };

  const updateField = (field: keyof SignInFormValues, value: string) => {
    setFields((current) => ({ ...current, [field]: value }));
    setErr(null);
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleRememberEmailChange = (checked: boolean) => {
    setRememberOverride(checked);

    if (!checked) {
      setFields((current) => ({ ...current, email: form.email }));

      try {
        window.localStorage.removeItem(rememberedEmailKey);
      } catch {
        // Continue sign-in if browser storage is unavailable.
      }
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      description="Please enter your details to sign in."
      icon={<FaUserAlt size={20} />}
      asForm
      onSubmitAction={onSubmitAction}
    >
      <Alert status="error" message={err} />

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
          <EmailField
            id="signin-email"
            name="email"
            label="Email"
            value={form.email}
            onChangeAction={(value) => updateField("email", value)}
            fullWidth
            rounded="lg"
            color="neutral"
            autoComplete="username"
            error={fieldErrors.email}
            required
          />

          <PasswordField
            id="signin-password"
            name="password"
            label="Password"
            value={form.password}
            onChangeAction={(value) => updateField("password", value)}
            fullWidth
            rounded="lg"
            color="neutral"
            autoComplete="current-password"
            error={fieldErrors.password}
            required
            minLength={6}
          />

          <AuthSubmitButton type="submit" loading={loading} disabled={loading}>
            Sign in
          </AuthSubmitButton>

          <SignInFormFooter
            rememberEmail={rememberEmail}
            onRememberEmailChangeAction={handleRememberEmailChange}
          />
        </fieldset>
      </div>
    </AuthShell>
  );
}
