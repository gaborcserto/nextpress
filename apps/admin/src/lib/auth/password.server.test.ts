import { beforeEach, expect, it, vi } from "vitest";

const { hash, verify, legacyVerify } = vi.hoisted(() => ({ hash: vi.fn(), verify: vi.fn(), legacyVerify: vi.fn() }));
vi.mock("better-auth/crypto", () => ({ hashPassword: hash, verifyPassword: verify }));
vi.mock("bcryptjs", () => ({ default: { compare: legacyVerify } }));

import { hashPassword, verifyCredentialPassword } from "./password.server";

beforeEach(() => vi.resetAllMocks());

it("bounds hashing and verification concurrency together without queuing requests", async () => {
  const completions: (() => void)[] = [];
  hash.mockImplementation(() => new Promise<string>((resolve) => completions.push(() => resolve("hash"))));
  verify.mockImplementation(() => new Promise<boolean>((resolve) => completions.push(() => resolve(true))));
  legacyVerify.mockImplementation(() => new Promise<boolean>((resolve) => completions.push(() => resolve(true))));
  const work = [hashPassword("password"), hashPassword("another"), verifyCredentialPassword({ hash: "scrypt", password: "password" }), verifyCredentialPassword({ hash: "$2b$legacy", password: "password" })];
  await expect(hashPassword("extra")).rejects.toMatchObject({ statusCode: 429, headers: { "Retry-After": "1" } });
  expect(hash).toHaveBeenCalledTimes(2);
  expect(verify).toHaveBeenCalledTimes(1);
  expect(legacyVerify).toHaveBeenCalledTimes(1);
  completions.forEach((complete) => complete());
  await Promise.all(work);
  hash.mockResolvedValue("fresh");
  await expect(hashPassword("retry")).resolves.toBe("fresh");
});

it("releases capacity after password work throws", async () => {
  hash.mockRejectedValue(new Error("Hash failure"));
  for (let i = 0; i < 5; i++) await expect(hashPassword("password")).rejects.toThrow("Hash failure");
  hash.mockResolvedValue("hash");
  await expect(hashPassword("retry")).resolves.toBe("hash");
});
