// @vitest-environment node
import bcrypt from "bcryptjs";
import { beforeEach, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({ prisma: {
  role: { upsert: vi.fn(), findUniqueOrThrow: vi.fn() },
  siteSettings: { upsert: vi.fn() },
  oAuthProvider: { upsert: vi.fn() },
  user: { findUnique: vi.fn(), upsert: vi.fn() },
  account: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
} }));
vi.mock("@nextpress/db", () => ({ prisma }));

import { bootstrapAdmin } from "./admin-bootstrap";
import { verifyCredentialPassword } from "@/lib/auth/password.server";

const environment = { NODE_ENV: "development", ADMIN_EMAIL: "admin@example.com", ADMIN_PASSWORD: "a known local admin passphrase" } satisfies NodeJS.ProcessEnv;

beforeEach(() => {
  vi.resetAllMocks();
  prisma.role.findUniqueOrThrow.mockResolvedValue({ id: "admin-role" });
  prisma.siteSettings.upsert.mockResolvedValue({ id: "default" });
  prisma.user.upsert.mockResolvedValue({ id: "admin-user", email: environment.ADMIN_EMAIL });
});

it("creates a user-keyed credential whose configured password passes the login verifier", async () => {
  prisma.user.findUnique.mockResolvedValue(null);
  prisma.account.create.mockImplementation(async ({ data }: { data: { password: string } }) => {
    expect(data.password).not.toBe(environment.ADMIN_PASSWORD);
    expect(await verifyCredentialPassword({ hash: data.password, password: environment.ADMIN_PASSWORD })).toBe(true);
    expect(await verifyCredentialPassword({ hash: data.password, password: "incorrect password" })).toBe(false);
  });
  expect(await bootstrapAdmin(environment)).toEqual({ preservedPassword: false });
  expect(prisma.user.upsert).toHaveBeenCalledWith(expect.objectContaining({
    where: { email: environment.ADMIN_EMAIL },
    create: expect.objectContaining({ email: environment.ADMIN_EMAIL, role: { connect: { id: "admin-role" } } }),
  }));
  expect(prisma.account.create).toHaveBeenCalledWith({ data: {
    userId: "admin-user", provider: "credential", providerAccountId: "admin-user", password: expect.any(String),
  } });
});

it("repairs legacy account identity on repeated runs while preserving the usable bcrypt password", async () => {
  const hash = await bcrypt.hash("admin123", 4);
  prisma.user.findUnique.mockResolvedValue({ id: "admin-user" });
  prisma.account.findFirst.mockResolvedValue({ id: "legacy-account", password: hash });
  const legacyEnvironment = { ...environment, ADMIN_PASSWORD: "admin123" };
  for (let run = 0; run < 2; run++) {
    expect(await bootstrapAdmin(legacyEnvironment)).toEqual({ preservedPassword: true });
  }
  expect(prisma.account.update).toHaveBeenCalledTimes(2);
  expect(prisma.account.update).toHaveBeenCalledWith({ where: { id: "legacy-account" }, data: { providerAccountId: "admin-user" } });
  expect(prisma.account.create).not.toHaveBeenCalled();
  expect(await verifyCredentialPassword({ hash, password: "admin123" })).toBe(true);
});

it("preserves a changed existing password instead of silently resetting it to ADMIN_PASSWORD", async () => {
  prisma.user.findUnique.mockResolvedValue({ id: "admin-user" });
  prisma.account.findFirst.mockResolvedValue({ id: "account", password: "existing-hash" });
  await bootstrapAdmin(environment);
  expect(prisma.account.update).toHaveBeenCalledWith({ where: { id: "account" }, data: { providerAccountId: "admin-user" } });
});

it("fills a missing password with a valid new credential", async () => {
  prisma.user.findUnique.mockResolvedValue({ id: "admin-user" });
  prisma.account.findFirst.mockResolvedValue({ id: "account", password: null });
  await bootstrapAdmin(environment);
  expect(prisma.account.update).toHaveBeenCalledWith({ where: { id: "account" }, data: { providerAccountId: "admin-user", password: expect.any(String) } });
});

it.each([false, true])("rejects weak new passwords before writes (existing user: %s)", async (existing) => {
  prisma.user.findUnique.mockResolvedValue(existing ? { id: "admin-user" } : null);
  prisma.account.findFirst.mockResolvedValue({ id: "account", password: null });
  await expect(bootstrapAdmin({ ...environment, ADMIN_PASSWORD: "admin123" })).rejects.toThrow(/at least 15/);
  expect(prisma.role.upsert).not.toHaveBeenCalled();
  expect(prisma.user.upsert).not.toHaveBeenCalled();
  expect(prisma.account.create).not.toHaveBeenCalled();
  expect(prisma.account.update).not.toHaveBeenCalled();
});
