export function adminSecurityHeaders(production: boolean) {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    // Legacy fallback agrees with CSP frame-ancestors 'none'.
    { key: "X-Frame-Options", value: "DENY" },
    // Never send auth paths/queries to providers; retain same-origin referrers.
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    // Production auth requires HTTPS. No assumptions about sibling hosts.
    ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
  ];
}

export function adminContentSecurityPolicy(
  nonce: string,
  production: boolean,
  authURL?: string,
  allowDataImages = false,
) {
  let authOrigin = "";
  if (authURL) {
    const url = new URL(authURL);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      (production && url.protocol !== "https:")) {
      throw new Error("Invalid authentication application URL");
    }
    // The existing auth client supports a separately configured auth origin.
    authOrigin = ` ${url.origin}`;
  }
  return [
    "default-src 'self'",
    // Next.js reads the nonce from the forwarded request CSP and tags its scripts.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${production ? "" : " 'unsafe-eval'"}`,
    "script-src-attr 'none'",
    // Dev tooling injects style elements without nonces.
    production ? `style-src 'self' 'nonce-${nonce}'` : "style-src 'self' 'unsafe-inline'",
    // Slate, Framer Motion, and shell primitives require inline style attributes.
    "style-src-attr 'unsafe-inline'",
    // Persisted media and OAuth avatars support arbitrary HTTPS image hosts.
    `img-src 'self' https:${production ? "" : " http:"}${allowDataImages ? " data:" : ""}`,
    "font-src 'self'",
    `connect-src 'self'${authOrigin}${production ? "" : " ws: wss:"}`,
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    // OAuth uses top-level navigation via Better Auth, not external HTML forms.
    "form-action 'self'",
    ...(production ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
