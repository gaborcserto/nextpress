export function webSecurityHeaders(production: boolean) {
  const policy = [
    "default-src 'self'",
    // This public app uses static generation. Next.js emits inline hydration
    // scripts whose hashes vary with build output. Keep this exception separate
    // from admin's nonce policy; it does not prevent inline script injection.
    `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
    "script-src-attr 'none'",
    production ? "style-src 'self'" : "style-src 'self' 'unsafe-inline'",
    // Next/Image emits inline image style attributes in the current page.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self'",
    "font-src 'self'",
    `connect-src 'self'${production ? "" : " ws: wss:"}`,
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    ...(production ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  return [
    { key: "Content-Security-Policy", value: policy },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
  ];
}
