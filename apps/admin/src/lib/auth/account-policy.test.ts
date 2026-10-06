// @vitest-environment node
import bcrypt from "bcryptjs";
import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { db, prisma, requestHeaders } = vi.hoisted(() => ({
  db: { User: [] as Record<string, unknown>[], Account: [] as Record<string, unknown>[], Session: [] as Record<string, unknown>[], verification: [] as Record<string, unknown>[] },
  prisma: { oAuthProvider: { findMany: vi.fn() }, role: { findUniqueOrThrow: vi.fn() }, user: { findUnique: vi.fn(), create: vi.fn() } },
  requestHeaders: vi.fn(),
}));
vi.mock("@nextpress/db/src/client", () => ({ prisma }));
vi.mock("better-auth/adapters/prisma", () => ({ prismaAdapter: () => memoryAdapter(db) }));
vi.mock("better-auth/next-js", () => ({ nextCookies: () => ({ id: "test-cookies" }) }));
vi.mock("next/headers", () => ({ headers: requestHeaders }));

import { getAuth, withAuth, type AppAuth } from "./auth-server";
import { verifyCredentialPassword } from "./password.server";
import { POST as createUser } from "@/app/api/admin/users/create/route";

const password = "a long passphrase";
const origin = "http://localhost:49101";

async function call(path: string, body: unknown) {
  const auth = await getAuth();
  return auth.handler(new Request(`${origin}/api/auth${path}`, {
    method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  vi.stubEnv("BETTER_AUTH_URL", origin);
  vi.stubEnv("NEXT_PUBLIC_BETTER_AUTH_URL", "");
  vi.stubEnv("NEXT_PUBLIC_ADMIN_URL", "");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-only-auth-secret-with-at-least-32-characters");
  for (const rows of Object.values(db)) rows.length = 0;
  vi.clearAllMocks();
  prisma.oAuthProvider.findMany.mockResolvedValue([]);
  prisma.role.findUniqueOrThrow.mockResolvedValue({ id: "subscriber-role" });
  requestHeaders.mockResolvedValue(new Headers());
});
afterEach(() => vi.unstubAllEnvs());

async function sessionRequest(auth: AppAuth, path: string, body: unknown = {}, cookie?: string, requestOrigin = origin) {
  return auth.handler(new Request(`${requestOrigin}/api/auth${path}`, {
    method: "POST", headers: { origin: requestOrigin, "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  }));
}

async function signIn(auth: AppAuth, cookie?: string, requestOrigin = origin) {
  const response = await sessionRequest(auth, "/sign-in/email", { email: "user@example.com", password }, cookie, requestOrigin);
  expect(response.status).toBe(200);
  const name = (await auth.$context).authCookies.sessionToken.name;
  const value = response.headers.getSetCookie().find((entry) => entry.startsWith(`${name}=`));
  if (!value) throw new Error("Missing session cookie");
  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null || !("token" in body) || typeof body.token !== "string") {
    throw new Error("Missing session token");
  }
  return { response, cookie: value.split(";", 1)[0], token: body.token };
}

async function registeredAuth() {
  const auth = await getAuth();
  expect((await sessionRequest(auth, "/sign-up/email", { name: "User", email: "user@example.com", password })).status).toBe(200);
  return auth;
}

describe("session lifecycle with the installed Better Auth", () => {
  it("sets the effective development cookie attributes and a seven-day lifetime", async () => {
    const auth = await registeredAuth();
    const { response } = await signIn(auth);
    const cookie = response.headers.getSetCookie()[0];
    expect(cookie).toContain("better-auth.session_token=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=604800");
    expect(cookie).not.toMatch(/Secure|Domain=/);
    expect(db.Session).toHaveLength(1);
  });

  it("derives Secure and __Secure- cookie prefixing for production HTTPS", async () => {
    await registeredAuth();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_URL", "https://admin.example.com");
    const auth = await getAuth();
    const { response } = await signIn(auth, undefined, "https://admin.example.com");
    const cookie = response.headers.getSetCookie()[0];
    expect(cookie).toContain("__Secure-better-auth.session_token=");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=604800");
    expect(cookie).not.toContain("Domain=");
  });

  it("uses fresh tokens at sign-in instead of adopting an incoming session identifier", async () => {
    const auth = await registeredAuth();
    const first = await signIn(auth, "better-auth.session_token=attacker-chosen");
    const second = await signIn(auth, first.cookie);
    expect(first.token).not.toBe("attacker-chosen");
    expect(second.token).not.toBe(first.token);
    expect(db.Session).toHaveLength(2);
  });

  it("does not roll expiry after the default update age and rejects expired or invalid sessions", async () => {
    const auth = await registeredAuth();
    const { cookie } = await signIn(auth);
    const headers = new Headers({ cookie });
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    Object.assign(db.Session[0], { expires, updatedAt: new Date(Date.now() - 2 * 86400000) });
    expect(await auth.api.getSession({ headers })).not.toBeNull();
    expect(db.Session[0].expires).toEqual(expires);
    db.Session[0].expires = new Date(Date.now() - 1000);
    expect(await auth.api.getSession({ headers })).toBeNull();
    expect(await auth.api.getSession({ headers: new Headers({ cookie: "better-auth.session_token=invalid" }) })).toBeNull();
    requestHeaders.mockResolvedValue(headers);
    const protectedRoute = withAuth(["ADMIN"], () => Response.json({ success: true }));
    expect((await protectedRoute(new Request(`${origin}/api/test`, { method: "DELETE", headers: { origin } }), { params: {} })).status).toBe(401);
  });

  it("honors rememberMe=false with a browser-session cookie and one-day server expiry", async () => {
    const auth = await registeredAuth();
    const response = await sessionRequest(auth, "/sign-in/email", { email: "user@example.com", password, rememberMe: false });
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie()[0]).not.toMatch(/Max-Age|Expires=/);
    expect(new Date(String(db.Session[0].expires)).getTime() - Date.now()).toBeCloseTo(86400000, -4);
  });

  it("invalidates the server token and expires the browser cookie on logout", async () => {
    const auth = await registeredAuth();
    const { cookie } = await signIn(auth);
    const response = await sessionRequest(auth, "/sign-out", {}, cookie);
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie()).toContainEqual(expect.stringContaining("better-auth.session_token=; Max-Age=0"));
    expect(db.Session).toHaveLength(0);
    expect(await auth.api.getSession({ headers: new Headers({ cookie }) })).toBeNull();
  });

  it("reports a failed logout instead of claiming a reusable token was revoked", async () => {
    const auth = await registeredAuth();
    const { cookie } = await signIn(auth);
    vi.spyOn((await auth.$context).internalAdapter, "deleteSession").mockRejectedValueOnce(new Error("test storage failure"));
    const response = await sessionRequest(auth, "/sign-out", {}, cookie);
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ code: "SESSION_REVOCATION_FAILED" });
    expect(db.Session).toHaveLength(1);
  });

  it("uses the same local logout semantics for a session belonging to an OAuth-only account", async () => {
    const auth = await registeredAuth();
    const { cookie } = await signIn(auth);
    // Seed the account boundary; no provider exchange is simulated here.
    db.Account.splice(0, db.Account.length, {
      id: "google-account", userId: db.User[0].id, provider: "google", providerAccountId: "external-id",
    });
    expect((await sessionRequest(auth, "/sign-out", {}, cookie)).status).toBe(200);
    expect(db.Session).toHaveLength(0);
    expect(await auth.api.getSession({ headers: new Headers({ cookie }) })).toBeNull();
  });

  it("forces password-change revocation even when the client opts out, and rotates the current token", async () => {
    const auth = await registeredAuth();
    const first = await signIn(auth);
    const second = await signIn(auth);
    const response = await sessionRequest(auth, "/change-password", {
      currentPassword: password, newPassword: "another long passphrase", revokeOtherSessions: false,
    }, first.cookie);
    expect(response.status).toBe(200);
    const replacement = await response.json();
    expect(replacement.token).not.toBe(first.token);
    expect(replacement.token).not.toBe(second.token);
    expect(db.Session).toHaveLength(1);
    for (const { cookie } of [first, second]) {
      expect(await auth.api.getSession({ headers: new Headers({ cookie }) })).toBeNull();
    }
    const cookie = response.headers.getSetCookie()[0].split(";", 1)[0];
    expect(await auth.api.getSession({ headers: new Headers({ cookie }) })).not.toBeNull();
  });

  it("retains old sessions on a failed password change and configures recovery revocation", async () => {
    const auth = await registeredAuth();
    const { cookie } = await signIn(auth);
    expect((await sessionRequest(auth, "/change-password", {
      currentPassword: "incorrect password", newPassword: "another long passphrase",
    }, cookie)).status).toBe(400);
    expect(await auth.api.getSession({ headers: new Headers({ cookie }) })).not.toBeNull();
    expect(auth.options.emailAndPassword?.revokeSessionsOnPasswordReset).toBe(true);
    expect((await sessionRequest(auth, "/reset-password", { token: "fake", newPassword: password })).status).toBe(503);
  });

  it("keeps Better Auth's own origin and JSON guards active", async () => {
    const auth = await registeredAuth();
    const { cookie } = await signIn(auth);
    for (const requestOrigin of ["https://evil.example", "http://localhost:3000"]) {
      expect((await sessionRequest(auth, "/sign-out", {}, cookie, requestOrigin)).status).toBe(403);
    }
    expect((await auth.handler(new Request(`${origin}/api/auth/sign-out`, {
      method: "POST", headers: { cookie, "content-type": "application/json" }, body: "{}",
    }))).status).toBe(403);
    expect((await auth.handler(new Request(`${origin}/api/auth/sign-out`, {
      method: "POST", headers: { cookie, origin, "content-type": "text/plain" }, body: "{}",
    }))).status).toBe(415);
    expect(db.Session).toHaveLength(1);
  });

  it("rejects OAuth callbacks without valid library-managed state before creating a session", async () => {
    prisma.oAuthProvider.findMany.mockResolvedValue([{ provider: "google", enabled: true, clientId: "test-client", clientSecret: "test-secret" }]);
    const auth = await getAuth();
    const initiation = await sessionRequest(auth, "/sign-in/social", { provider: "google", callbackURL: `${origin}/admin` });
    expect(initiation.status).toBe(200);
    const state = new URL((await initiation.json()).url).searchParams.get("state");
    expect(state).toBeTruthy();
    for (const query of ["code=test", `code=test&state=${state}`, "code=test&state=forged"]) {
      const response = await auth.handler(new Request(`${origin}/api/auth/callback/google?${query}`));
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toMatch(/state_(not_found|mismatch)/);
    }
    expect(db.Session).toHaveLength(0);
  });

  it("enforces CSRF before lookup and preserves authentication and role checks for trusted mutations", async () => {
    const handler = vi.fn(() => Response.json({ success: true }));
    const protectedRoute = withAuth(["ADMIN"], handler);
    const req = (originHeader = origin) => new Request(`${origin}/api/test`, {
      method: "POST", headers: { origin: originHeader, "content-type": "application/json" }, body: "{}",
    });
    expect((await protectedRoute(req("https://evil.example"), { params: {} })).status).toBe(403);
    expect(requestHeaders).not.toHaveBeenCalled();
    expect((await protectedRoute(req(), { params: {} })).status).toBe(401);
    const auth = await registeredAuth();
    const { cookie } = await signIn(auth);
    requestHeaders.mockResolvedValue(new Headers({ cookie }));
    prisma.user.findUnique.mockResolvedValue({ roleId: "role", role: { name: "AUTHOR" } });
    expect((await protectedRoute(req(), { params: {} })).status).toBe(401);
    prisma.user.findUnique.mockResolvedValue({ roleId: "role", role: { name: "ADMIN" } });
    expect((await protectedRoute(req(), { params: {} })).status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("configured authentication policy with real Better Auth", () => {
  it.each([
    { email: "malformed", password },
    { email: "user@example.com", password: "short" },
    { email: "user@example.com", password: "😀".repeat(8) },
    { email: "user@example.com", password: "a".repeat(129) },
    { email: "user@example.com", password: "😀".repeat(65) },
    { email: "user@example.com", password: "\uD800".repeat(15) },
  ])("rejects invalid direct HTTP signup without persistence: %j", async (input) => {
    expect((await call("/sign-up/email", { name: "User", ...input })).status).toBe(400);
    expect(db.User).toHaveLength(0);
    expect(db.Account).toHaveLength(0);
  });

  it.each([{ role: "ADMIN" }, { roleId: "admin-role" }])("rejects client role assignment: %j", async (role) => {
    expect((await call("/sign-up/email", { name: "User", email: "user@example.com", password, ...role })).status).toBe(400);
    expect(db.User).toHaveLength(0);
  });

  it("normalizes email, assigns SUBSCRIBER, leaves email unverified, and conceals duplicate registration", async () => {
    const first = await call("/sign-up/email", { name: "User", email: " User@Example.com ", image: "https://example.com/avatar.png", password });
    expect(first.status).toBe(200);
    const created = await first.json();
    expect(created).toMatchObject({ token: null, user: { email: "user@example.com", emailVerified: false } });
    expect(created.user).not.toHaveProperty("roleId");
    expect(db.User[0]).toMatchObject({ roleId: "subscriber-role" });
    expect(db.User).toHaveLength(1);
    expect(db.Session).toHaveLength(0);
    const duplicate = await call("/sign-up/email", { name: "User", email: "USER@example.com", image: "https://example.com/avatar.png", password });
    expect(duplicate.status).toBe(200);
    const repeated = await duplicate.json();
    expect(repeated).toMatchObject({ token: null, user: { email: "user@example.com", emailVerified: false } });
    expect(Object.keys(repeated.user).sort()).toEqual(Object.keys(created.user).sort());
    expect(db.User).toHaveLength(1);
    expect((await call("/sign-in/email", { email: " USER@example.com ", password })).status).toBe(200);
  });

  it("distinguishes multibyte passwords beyond bcrypt's byte boundary", async () => {
    const long = "界".repeat(30);
    expect((await call("/sign-up/email", { name: "User", email: "user@example.com", password: long })).status).toBe(200);
    expect((await call("/sign-in/email", { email: "user@example.com", password: long })).status).toBe(200);
    expect((await call("/sign-in/email", { email: "user@example.com", password: "界".repeat(24) + "different" })).status).toBe(401);
  });

  it.each(["/request-password-reset", "/reset-password", "/send-verification-email"])("reports unavailable delivery uniformly at %s without minting tokens", async (path) => {
    const known = await call(path, { email: "known@example.com", token: "fake", newPassword: password });
    db.User.push({ id: "known", email: "known@example.com", emailVerified: false });
    const existing = await call(path, { email: "known@example.com", token: "fake", newPassword: password });
    expect(known.status).toBe(503);
    expect(existing.status).toBe(503);
    expect(await existing.json()).toEqual(await known.json());
    expect(db.verification).toHaveLength(0);
    expect(db.Account).toHaveLength(0);
  });

  it("rejects reset callbacks and verification links when email delivery is unavailable", async () => {
    const auth = await getAuth();
    for (const path of ["/reset-password/fake?callbackURL=/auth/reset-password", "/verify-email?token=fake"]) {
      expect((await auth.handler(new Request(`${origin}/api/auth${path}`))).status).toBe(503);
    }
  });

  it("uses the same policy for server API signup and password changes", async () => {
    const auth = await getAuth();
    await expect(auth.api.signUpEmail({ body: { name: "User", email: "user@example.com", password: "short" } })).rejects.toMatchObject({ statusCode: 400 });
    await call("/sign-up/email", { name: "User", email: "user@example.com", password });
    const login = await call("/sign-in/email", { email: "user@example.com", password });
    const cookie = login.headers.get("set-cookie")?.split(";")[0];
    if (!cookie) throw new Error("Missing sign-in cookie");
    const headers = new Headers({ cookie });
    await expect(auth.api.setPassword({ headers, body: { newPassword: "😀".repeat(8) } })).rejects.toMatchObject({ statusCode: 400 });
    await expect(auth.api.changePassword({ headers, body: { currentPassword: password, newPassword: "😀".repeat(8) } })).rejects.toMatchObject({ statusCode: 400 });
    await expect(auth.api.changePassword({ headers, body: { currentPassword: password, newPassword: "a".repeat(129) } })).rejects.toMatchObject({ statusCode: 400 });
    await expect(auth.api.changePassword({ headers, body: { currentPassword: password, newPassword: "another long passphrase" } })).resolves.toMatchObject({ token: expect.any(String) });
    expect((await call("/sign-in/email", { email: "user@example.com", password: "another long passphrase" })).status).toBe(200);
  });

  it("provisions an ADMIN-only credential account that authenticates normally", async () => {
    await call("/sign-up/email", { name: "Admin", email: "admin@example.com", password });
    prisma.user.findUnique.mockResolvedValue({ roleId: "admin-role", role: { name: "ADMIN" } });
    const login = await call("/sign-in/email", { email: "admin@example.com", password });
    const cookie = login.headers.get("set-cookie")?.split(";")[0];
    if (!cookie) throw new Error("Missing admin cookie");
    requestHeaders.mockResolvedValue(new Headers({ cookie }));
    prisma.user.findUnique.mockResolvedValueOnce({ roleId: "admin-role" }).mockResolvedValueOnce({ role: { name: "ADMIN" } }).mockResolvedValueOnce(null);
    prisma.user.create.mockImplementation(async ({ data }: { data: { id: string; email: string; name: string; accounts: { create: Record<string, unknown> } } }) => {
      db.User.push({ id: data.id, email: data.email, name: data.name, emailVerified: false, createdAt: new Date(), updatedAt: new Date() });
      db.Account.push({ id: "provisioned-account", userId: data.id, ...data.accounts.create });
      return { id: data.id, email: data.email, name: data.name, role: { name: "ADMIN" } };
    });
    const result = await createUser(new Request(`${origin}/api/admin/users/create`, {
      method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ email: "new@example.com", name: "New", role: "ADMIN", password }),
    }), { params: {} });
    expect(result.status).toBe(201);
    expect((await call("/sign-in/email", { email: "new@example.com", password })).status).toBe(200);
  });

  it("does not give an OAuth-only user credential access and uses a generic login failure", async () => {
    db.User.push({ id: "oauth", email: "oauth@example.com", name: "OAuth", emailVerified: true });
    db.Account.push({ id: "provider", userId: "oauth", provider: "google", providerAccountId: "external-id" });
    const oauth = await call("/sign-in/email", { email: "oauth@example.com", password });
    const missing = await call("/sign-in/email", { email: "missing@example.com", password });
    expect(oauth.status).toBe(401);
    expect(await oauth.json()).toEqual(await missing.json());
    expect((await getAuth()).options.account?.accountLinking).toMatchObject({ disableImplicitLinking: true, trustedProviders: [], allowDifferentEmails: false });
  });

  it("keeps bounded legacy bcrypt credentials usable without accepting truncated suffixes", async () => {
    const hash = await bcrypt.hash("legacy password", 4);
    db.User.push({ id: "legacy", name: "Legacy", email: "legacy@example.com", emailVerified: false });
    db.Account.push({ id: "legacy-account", userId: "legacy", provider: "credential", providerAccountId: "legacy", password: hash });
    expect((await call("/sign-in/email", { email: "legacy@example.com", password: "legacy password" })).status).toBe(200);
    expect(await verifyCredentialPassword({ hash, password: "legacy password" })).toBe(true);
    expect(await verifyCredentialPassword({ hash, password: "incorrect password" })).toBe(false);
    const unicode = "界".repeat(24);
    const unicodeHash = await bcrypt.hash(unicode, 4);
    expect(await verifyCredentialPassword({ hash: unicodeHash, password: unicode })).toBe(true);
    expect(await verifyCredentialPassword({ hash: unicodeHash, password: unicode + "a" })).toBe(false);
    expect(await verifyCredentialPassword({ hash: unicodeHash, password: "a".repeat(129) })).toBe(false);
  });
});
