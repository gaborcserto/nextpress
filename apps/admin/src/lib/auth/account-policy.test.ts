// @vitest-environment node
import bcrypt from "bcryptjs";
import { memoryAdapter } from "better-auth/adapters/memory";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, prisma, requestHeaders } = vi.hoisted(() => ({
  db: { User: [] as Record<string, unknown>[], Account: [] as Record<string, unknown>[], Session: [] as Record<string, unknown>[], verification: [] as Record<string, unknown>[] },
  prisma: { oAuthProvider: { findMany: vi.fn() }, role: { findUniqueOrThrow: vi.fn() }, user: { findUnique: vi.fn(), create: vi.fn() } },
  requestHeaders: vi.fn(),
}));
vi.mock("@nextpress/db/src/client", () => ({ prisma }));
vi.mock("better-auth/adapters/prisma", () => ({ prismaAdapter: () => memoryAdapter(db) }));
vi.mock("better-auth/next-js", () => ({ nextCookies: () => ({ id: "test-cookies" }) }));
vi.mock("next/headers", () => ({ headers: requestHeaders }));

import { getAuth } from "./auth-server";
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
  vi.stubEnv("BETTER_AUTH_SECRET", "test-only-auth-secret-with-at-least-32-characters");
  for (const rows of Object.values(db)) rows.length = 0;
  vi.clearAllMocks();
  prisma.oAuthProvider.findMany.mockResolvedValue([]);
  prisma.role.findUniqueOrThrow.mockResolvedValue({ id: "subscriber-role" });
  requestHeaders.mockResolvedValue(new Headers());
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
    await expect(auth.api.changePassword({ headers, body: { currentPassword: password, newPassword: "another long passphrase" } })).resolves.toMatchObject({ token: null });
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
      method: "POST", body: JSON.stringify({ email: "new@example.com", name: "New", role: "ADMIN", password }),
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
