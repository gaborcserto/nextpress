export function mapNextAuthError(code?: string | null): string | null {
  if (!code) return null;
  const map: Record<string, string> = {
    OAuthSignin: "OAuth sign-in failed.",
    OAuthCallback: "OAuth callback failed.",
    OAuthAccountNotLinked: "Account not linked to this provider.",
    CredentialsSignin: "Invalid email or password.",
    AccessDenied: "Access denied.",
    default: "Sign in failed.",
  };
  return Object.hasOwn(map, code) ? map[code] : map.default;
}
