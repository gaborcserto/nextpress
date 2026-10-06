import "server-only";

function configuredURLs() {
  return [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_ADMIN_URL].filter((value): value is string => !!value);
}

function applicationOrigin(value: string): string {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Invalid authentication application URL");
  }
  if (process.env.NODE_ENV === "production" &&
    (url.protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) {
    throw new Error("Production authentication requires an HTTPS application URL");
  }
  return url.origin;
}

export function getAuthBaseURL(): string {
  const value = configuredURLs()[0] ?? "http://localhost:49101";
  applicationOrigin(value);
  return value;
}

export function getTrustedOrigins(): string[] {
  const origins = configuredURLs().map(applicationOrigin);
  if (process.env.NODE_ENV !== "production") {
    origins.push("http://localhost:49101", "http://127.0.0.1:49101");
  }
  return [...new Set(origins)];
}
