export function disposableDatabaseName(
  testUrl: string | undefined,
  actualUrl: string | undefined,
  family: "content" | "security",
) {
  if (!testUrl || testUrl !== actualUrl) {
    throw new Error("Explicit matching disposable database URLs required");
  }
  const url = new URL(testUrl);
  const pattern =
    family === "content"
      ? /^nextpress_phase1_verify_[a-z0-9_]+$/
      : /^nextpress_security_verify_[a-z0-9_]+$/;
  const name = url.pathname.slice(1);

  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    !pattern.test(name) ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Only explicitly designated local disposable databases are allowed",
    );
  }

  return name;
}
