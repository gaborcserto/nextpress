import "server-only";

function configuredURLs() {
  return [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_ADMIN_URL].filter((value): value is string => !!value);
}

export function getAuthSecret(): string | undefined {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters in production");
  }
  return secret;
}

function applicationOrigin(value: string): string {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
    url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Invalid authentication application URL");
  }
  if (process.env.NODE_ENV === "production" &&
    (url.protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) {
    throw new Error("Production authentication requires an HTTPS application URL");
  }
  return url.origin;
}

export function getAuthBaseURL(): string {
  const value = configuredURLs()[0];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_URL is required in production");
  }
  const resolved = value ?? "http://localhost:49101";
  applicationOrigin(resolved);
  return resolved;
}

export function getTrustedOrigins(): string[] {
  const urls = configuredURLs();
  if (process.env.NODE_ENV === "production" && !process.env.BETTER_AUTH_URL) {
    throw new Error("BETTER_AUTH_URL is required in production");
  }
  const origins = urls.map(applicationOrigin);
  if (process.env.NODE_ENV !== "production") {
    origins.push("http://localhost:49101", "http://127.0.0.1:49101");
  }
  return [...new Set(origins)];
}
