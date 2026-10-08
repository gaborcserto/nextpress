// @vitest-environment node
import bcrypt from "bcryptjs";
import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { db, prisma, requestHeaders } = vi.hoisted(() => ({
  db: { User: [] as Record<string, unknown>[], Account: [] as Record<string, unknown>[], Session: [] as Record<string, unknown>[], verification: [] as Record<string, unknown>[] },
  prisma: {
    oAuthProvider: { findMany: vi.fn(), upsert: vi.fn() },
    role: { findUniqueOrThrow: vi.fn(), upsert: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn() },
    account: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    siteSettings: { upsert: vi.fn() },
  },
  requestHeaders: vi.fn(),
}));
vi.mock("@nextpress/db/src/client", () => ({ prisma }));
vi.mock("@nextpress/db", () => ({ prisma }));
vi.mock("better-auth/adapters/prisma", () => ({ prismaAdapter: () => memoryAdapter(db) }));
vi.mock("better-auth/next-js", () => ({ nextCookies: () => ({ id: "test-cookies" }) }));
vi.mock("next/headers", () => ({ headers: requestHeaders }));

import { getAuth, getSessionWithRole, withAuth, type AppAuth } from "./auth-server";
import { verifyCredentialPassword } from "./password.server";
import { bootstrapAdmin } from "../../../scripts/admin-bootstrap";
import { POST as createUser } from "@/app/api/admin/users/create/route";
import { POST as authRoute } from "@/app/api/auth/[...all]/route";
import { accountAttempts, actionLimits, authBudgets } from "@/lib/security/rate-limit.server";
import type { BetterAuthOptions } from "better-auth";

const password = "a long passphrase";
const origin = "http://localhost:49101";

async function call(path: string, body: unknown) {
  const auth = await getAuth();
  return auth.handler(new Request(`${origin}/api/auth${path}`, {
    method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  accountAttempts.clear();
  actionLimits.clear();
  authBudgets.clear();
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
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

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

async function registeredAuthWithFastPasswords() {
  const auth = await getAuth();
  const passwordWork = (await auth.$context).password;
  vi.spyOn(passwordWork, "hash").mockResolvedValue("test-hash");
  const verify = vi.spyOn(passwordWork, "verify").mockImplementation(async ({ hash, password: candidate }) => {
    return hash === "test-hash" && candidate === password;
  });
  expect((await sessionRequest(auth, "/sign-up/email", { name: "User", email: "user@example.com", password })).status).toBe(200);
  return { auth, verify };
}

describe("authentication abuse boundaries with the installed Better Auth", () => {
  it("throttles normalized failed credentials without revealing account existence, then expires", async () => {
    const { auth, verify } = await registeredAuthWithFastPasswords();
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.now());
    const start = Date.now();
    let failure: unknown;
    for (let i = 0; i < 5; i++) {
      const known = await sessionRequest(auth, "/sign-in/email", { email: i % 2 ? " USER@Example.com " : "user@example.com", password: "wrong password" });
      const missing = await sessionRequest(auth, "/sign-in/email", { email: i % 2 ? " MISSING@Example.com " : "missing@example.com", password: "wrong password" });
      expect(known.status).toBe(401);
      failure = await known.json();
      expect(await missing.json()).toEqual(failure);
    }
    expect(verify).toHaveBeenCalledTimes(5);
    const throttled = await sessionRequest(auth, "/sign-in/email", { email: "user@example.com", password });
    const missing = await sessionRequest(auth, "/sign-in/email", { email: "missing@example.com", password });
    expect(throttled.status).toBe(429);
    expect(missing.status).toBe(429);
    expect(throttled.headers.get("retry-after")).toBe("60");
    expect(await throttled.json()).toEqual(await missing.json());
    expect(verify).toHaveBeenCalledTimes(5);
    now.mockReturnValue(start + 59_001);
    const stillBlocked = await sessionRequest(auth, "/sign-in/email", { email: "user@example.com", password });
    expect(stillBlocked.status).toBe(429);
    expect(stillBlocked.headers.get("retry-after")).toBe("1");
    now.mockReturnValue(start + 60_000);
    expect((await sessionRequest(auth, "/sign-in/email", { email: "user@example.com", password })).status).toBe(200);
  });

  it("resets account attempts after success while retaining the process work budget", async () => {
    const { auth } = await registeredAuthWithFastPasswords();
    for (let i = 0; i < 4; i++) await sessionRequest(auth, "/sign-in/email", { email: "user@example.com", password: "wrong" });
    expect((await sessionRequest(auth, "/sign-in/email", { email: "user@example.com", password })).status).toBe(200);
    for (let i = 0; i < 5; i++) expect((await sessionRequest(auth, "/sign-in/email", { email: "user@example.com", password: "wrong" })).status).toBe(401);
    expect((await sessionRequest(auth, "/sign-in/email", { email: "user@example.com", password })).status).toBe(429);
    for (let i = 0; i < 60; i++) authBudgets.consume("credential-work", 60, 60_000);
    expect((await sessionRequest(auth, "/sign-in/email", { email: "different@example.com", password })).status).toBe(429);
  });

  it("reserves parallel guesses before password verification starts", async () => {
    const auth = await registeredAuth();
    let release = () => {};
    const passwordGate = new Promise<void>((resolve) => { release = resolve; });
    let signalReserved = () => {};
    const attemptsReserved = new Promise<void>((resolve) => { signalReserved = resolve; });
    // Admit the five account attempts before starting real password work, so
    // completion speed cannot affect the four-slot concurrency assertion.
    const verify = vi.spyOn((await auth.$context).password, "verify").mockImplementation(async (input) => {
      if (verify.mock.calls.length === 5) signalReserved();
      await passwordGate;
      return verifyCredentialPassword(input);
    });
    const requests = Array.from({ length: 12 }, () => sessionRequest(auth, "/sign-in/email", { email: "user@example.com", password: "wrong" }));
    try {
      await attemptsReserved;
    } finally {
      release();
    }
    const responses = await Promise.all(requests);
    expect(responses.filter((response) => response.status === 401)).toHaveLength(4);
    expect(responses.filter((response) => response.status === 429)).toHaveLength(8);
    expect(verify).toHaveBeenCalledTimes(5);
  });

  it("covers direct server API guesses and rejects malformed bodies before hashing", async () => {
    const auth = await getAuth();
    const hash = vi.spyOn((await auth.$context).password, "hash");
    for (let i = 0; i < 5; i++) {
      await expect(auth.api.signInEmail({ body: { email: "bad-email", password } })).rejects.toMatchObject({ statusCode: 400 });
    }
    await expect(auth.api.signInEmail({ body: { email: "other-invalid", password } })).rejects.toMatchObject({ statusCode: 429 });
    expect(hash).not.toHaveBeenCalled();
  });

  it("bounds credential stuffing across distinct emails without trusting proxy headers", async () => {
    const auth = await getAuth();
    vi.spyOn((await auth.$context).password, "hash").mockResolvedValue("test-hash");
    for (let i = 0; i < 60; i++) {
      const response = await auth.handler(new Request(`${origin}/api/auth/sign-in/email`, {
        method: "POST", headers: { origin, "content-type": "application/json", "x-forwarded-for": `192.0.2.${i}`, "x-real-ip": `192.0.2.${i}`, forwarded: `for=192.0.2.${i}` },
        body: JSON.stringify({ email: `missing${i}@example.com`, password }),
      }));
      expect(response.status).toBe(401);
    }
    const blocked = await sessionRequest(auth, "/sign-in/email", { email: "another@example.com", password });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    expect(auth.options.advanced?.ipAddress?.disableIpTracking).toBe(true);
    expect(auth.options.rateLimit?.enabled).toBe(false);
  });

  it("throttles repeated signup uniformly, preserving SUBSCRIBER and expiry", async () => {
    const auth = await getAuth();
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.now());
    const start = Date.now();
    for (let i = 0; i < 3; i++) {
      expect((await sessionRequest(auth, "/sign-up/email", { name: "User", email: " USER@example.com ", password })).status).toBe(200);
    }
    const blocked = await sessionRequest(auth, "/sign-up/email", { name: "User", email: "user@example.com", password });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("600");
    expect(db.User).toHaveLength(1);
    expect(db.User[0]).toMatchObject({ roleId: "subscriber-role" });
    for (let i = 0; i < 3; i++) expect((await sessionRequest(auth, "/sign-up/email", { name: "User", email: "missing@example.com", password: "short" })).status).toBe(400);
    const invalidBlocked = await sessionRequest(auth, "/sign-up/email", { name: "User", email: "missing@example.com", password });
    expect(invalidBlocked.status).toBe(429);
    expect(await invalidBlocked.json()).toEqual(await blocked.json());
    now.mockReturnValue(start + 600_000);
    expect((await sessionRequest(auth, "/sign-up/email", { name: "User", email: "user@example.com", password })).status).toBe(200);
  });

  it("bounds signup amplification across different identities before hashing", async () => {
    const auth = await getAuth();
    const hash = vi.spyOn((await auth.$context).password, "hash");
    for (let i = 0; i < 10; i++) expect((await sessionRequest(auth, "/sign-up/email", { name: "User", email: `new${i}@example.com`, password: "short" })).status).toBe(400);
    expect((await sessionRequest(auth, "/sign-up/email", { name: "User", email: "new@example.com", password })).status).toBe(429);
    expect(hash).not.toHaveBeenCalled();
    expect(db.User).toHaveLength(0);
  });

  it("shares credential budgets with password change and server password verification", async () => {
    const { auth } = await registeredAuthWithFastPasswords();
    const { cookie } = await signIn(auth);
    for (let i = 0; i < 5; i++) {
      const response = await sessionRequest(auth, "/change-password", { currentPassword: "wrong", newPassword: "another long passphrase" }, cookie);
      expect(response.status).toBe(400);
    }
    expect((await sessionRequest(auth, "/change-password", { currentPassword: password, newPassword: "another long passphrase" }, cookie)).status).toBe(429);
    await expect(auth.api.verifyPassword({ headers: new Headers({ cookie }), body: { password } })).rejects.toMatchObject({ statusCode: 429 });
    expect((await sessionRequest(auth, "/sign-in/email", { email: "user@example.com", password })).status).toBe(429);
  });

  it("caps OAuth state initiation and new-account creation", async () => {
    prisma.oAuthProvider.findMany.mockResolvedValue([{ provider: "google", enabled: true, clientId: "test-client", clientSecret: "test-secret" }]);
    const auth = await getAuth();
    for (let i = 0; i < 60; i++) authBudgets.consume("oauth-work", 60, 60_000);
    expect((await sessionRequest(auth, "/sign-in/social", { provider: "google", callbackURL: "/admin" })).status).toBe(429);
    expect(db.verification).toHaveLength(0);
    for (let i = 0; i < 30; i++) authBudgets.consume("account-creation", 30, 3_600_000);
    expect((await sessionRequest(auth, "/sign-up/email", { name: "User", email: "user@example.com", password })).status).toBe(429);
    expect(db.User).toHaveLength(0);
  });

  it("keeps recovery disabled without tokens regardless of exhausted budgets", async () => {
    const auth = await getAuth();
    for (let i = 0; i < 120; i++) authBudgets.consume("auth-ingress", 120, 60_000);
    for (const email of ["user@example.com", "missing@example.com"]) {
      expect((await sessionRequest(auth, "/request-password-reset", { email })).status).toBe(503);
    }
    expect(db.verification).toHaveLength(0);
  });

  it("bounds raw malformed HTTP requests before provider/database work", async () => {
    for (let i = 0; i < 120; i++) await authRoute(new Request(`${origin}/api/auth/sign-in/email`, {
      method: "POST", headers: { origin, "content-type": "application/json" }, body: "{",
    }));
    prisma.oAuthProvider.findMany.mockClear();
    const response = await authRoute(new Request(`${origin}/api/auth/sign-in/email`, {
      method: "POST", headers: { origin, "content-type": "application/json" }, body: "{",
    }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(prisma.oAuthProvider.findMany).not.toHaveBeenCalled();
  });

  it("rejects oversized auth bodies before parsing or querying providers", async () => {
    const response = await authRoute(new Request(`${origin}/api/auth/sign-up/email`, {
      method: "POST", headers: { origin, "content-type": "application/json" }, body: "x".repeat(16_385),
    }));
    expect(response.status).toBe(413);
    expect(prisma.oAuthProvider.findMany).not.toHaveBeenCalled();
  });

  it("bounds persisted registration profile fields", async () => {
    for (const fields of [{ name: "x".repeat(201) }, { image: "x".repeat(2049) }]) {
      expect((await call("/sign-up/email", { name: "User", email: "user@example.com", password, ...fields })).status).toBe(400);
    }
    expect(db.User).toHaveLength(0);
  });

  it("logs authentication failures with bounded generic events and discards sensitive arguments", async () => {
    const auth = await getAuth();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const options: BetterAuthOptions = auth.options;
    const log = options.logger?.log;
    if (!log) throw new Error("Missing safe authentication logger");
    for (let i = 0; i < 100; i++) log("error", "OAuth code=secret", { password: "secret", token: "secret" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("Authentication operation failed");
  });

  it("limits complete session/account listings while preserving revocation", async () => {
    const auth = await registeredAuth();
    const { cookie } = await signIn(auth);
    const headers = new Headers({ cookie });
    for (let i = 0; i < 30; i++) await expect(auth.api.listSessions({ headers })).resolves.toHaveLength(1);
    await expect(auth.api.listSessions({ headers })).rejects.toMatchObject({ statusCode: 429 });
    await expect(auth.api.listUserAccounts({ headers })).rejects.toMatchObject({ statusCode: 429 });
    expect((await sessionRequest(auth, "/sign-out", {}, cookie)).status).toBe(200);
    expect(db.Session).toHaveLength(0);
  });

  it("bounds authenticated profile mutations by verified user identity", async () => {
    const auth = await registeredAuth();
    const { cookie } = await signIn(auth);
    for (let i = 0; i < 30; i++) expect((await sessionRequest(auth, "/update-user", { name: "Updated" }, cookie)).status).toBe(200);
    expect((await sessionRequest(auth, "/update-user", { name: "Updated again" }, cookie)).status).toBe(429);
    expect(db.User[0]?.name).toBe("Updated");
  });
});

describe("session lifecycle with the installed Better Auth", () => {
  it("forwards the request cookie and preserves a session across admin navigation and appearance changes", async () => {
    const auth = await registeredAuth();
    const { cookie, token } = await signIn(auth);
    prisma.user.findUnique.mockResolvedValue({ roleId: "admin-role", role: { name: "ADMIN" } });
    const originalExpiry = db.Session[0].expires;
    for (const path of ["/admin", "/admin/taxonomy", "/admin/posts", "/admin/taxonomy"]) {
      requestHeaders.mockResolvedValue(new Headers({ cookie: `${cookie}; theme=dark`, referer: `${origin}${path}` }));
      expect((await getSessionWithRole())?.user.role).toBe("ADMIN");
    }
    requestHeaders.mockResolvedValue(new Headers({ cookie }));
    expect((await getSessionWithRole())?.user.role).toBe("ADMIN");
    expect(db.Session).toHaveLength(1);
    expect(db.Session[0]).toMatchObject({ sessionToken: token, expires: originalExpiry });
  });

  it("requires the session cookie on each protected request and distinguishes an insufficient role", async () => {
    const auth = await registeredAuth();
    const { cookie } = await signIn(auth);
    prisma.user.findUnique.mockResolvedValue({ roleId: "subscriber-role", role: { name: "SUBSCRIBER" } });
    const handler = vi.fn(() => Response.json({ success: true }));
    const protectedRoute = withAuth(["ADMIN", "EDITOR", "AUTHOR"], handler);
    const request = new Request(`${origin}/api/admin/tags`);
    requestHeaders.mockResolvedValue(new Headers({ cookie }));
    expect((await protectedRoute(request, { params: {} })).status).toBe(403);
    for (const cookieHeader of ["theme=dark", "better-auth.session_token=invalid", ""]) {
      requestHeaders.mockResolvedValue(new Headers({ cookie: cookieHeader }));
      expect(await getSessionWithRole()).toBeNull();
      expect((await protectedRoute(request, { params: {} })).status).toBe(401);
    }
    expect(handler).not.toHaveBeenCalled();
    prisma.user.findUnique.mockResolvedValue({ roleId: "author-role", role: { name: "AUTHOR" } });
    requestHeaders.mockResolvedValue(new Headers({ cookie }));
    expect((await protectedRoute(request, { params: {} })).status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("preserves credential callbacks and library-managed OAuth destination validation", async () => {
    const auth = await registeredAuth();
    const credentials = await sessionRequest(auth, "/sign-in/email", {
      email: "user@example.com", password, callbackURL: "/admin/profile?source=login",
    });
    expect(credentials.status).toBe(200);
    expect((await credentials.json()).url).toBe("/admin/profile?source=login");

    prisma.oAuthProvider.findMany.mockResolvedValue([{ provider: "google", enabled: true, clientId: "test-client", clientSecret: "test-secret" }]);
    const socialAuth = await getAuth();
    for (const callbackURL of ["/admin/profile", `${origin}/admin`]) {
      const response = await sessionRequest(socialAuth, "/sign-in/social", { provider: "google", callbackURL });
      expect(response.status).toBe(200);
      const providerURL = new URL((await response.json()).url);
      expect(providerURL.origin).toBe("https://accounts.google.com");
      expect(providerURL.searchParams.get("redirect_uri")).toBe(`${origin}/api/auth/callback/google`);
      expect(providerURL.searchParams.get("state")).toBeTruthy();
    }
    for (const callbackURL of ["//evil.example", "https://evil.example/admin", "javascript:alert(1)"]) {
      expect((await sessionRequest(socialAuth, "/sign-in/social", { provider: "google", callbackURL })).status).toBe(403);
    }
  });

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
    expect((await protectedRoute(req(), { params: {} })).status).toBe(403);
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

  it.each(["fresh", "legacy"])("authenticates the %s bootstrap account through Better Auth after repeated bootstrap", async (kind) => {
    const email = "admin@example.com";
    const configuredPassword = kind === "legacy" ? "admin123" : "a known local admin passphrase";
    let originalHash: string | undefined;
    if (kind === "legacy") {
      originalHash = await bcrypt.hash(configuredPassword, 4);
      db.User.push({ id: "bootstrap-admin", name: "Admin", email, emailVerified: true });
      db.Account.push({ id: "bootstrap-account", userId: "bootstrap-admin", provider: "credential", providerAccountId: email, password: originalHash });
      expect((await call("/sign-in/email", { email, password: configuredPassword })).status).toBe(401);
    }
    prisma.user.findUnique.mockImplementation(async () => db.User.find(user => user.email === email) ?? null);
    prisma.account.findFirst.mockImplementation(async () => db.Account.find(account => account.userId === "bootstrap-admin" && account.provider === "credential") ?? null);
    prisma.siteSettings.upsert.mockResolvedValue({ id: "default" });
    prisma.role.findUniqueOrThrow.mockResolvedValue({ id: "admin-role" });
    prisma.user.upsert.mockImplementation(async () => {
      if (!db.User.length) db.User.push({ id: "bootstrap-admin", name: "Admin", email, emailVerified: true });
      return { id: "bootstrap-admin", email };
    });
    prisma.account.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      db.Account.push({ id: "bootstrap-account", ...data });
    });
    prisma.account.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      Object.assign(db.Account[0], data);
    });
    const environment = { NODE_ENV: "development", ADMIN_EMAIL: email, ADMIN_PASSWORD: configuredPassword } satisfies NodeJS.ProcessEnv;
    await bootstrapAdmin(environment);
    const storedHash = db.Account[0]?.password;
    await bootstrapAdmin(environment);
    expect(db.Account[0]).toMatchObject({ providerAccountId: "bootstrap-admin", password: storedHash });
    if (originalHash) expect(storedHash).toBe(originalHash);
    expect((await call("/sign-in/email", { email, password: configuredPassword })).status).toBe(200);
    expect((await call("/sign-in/email", { email, password: "incorrect password" })).status).toBe(401);
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
