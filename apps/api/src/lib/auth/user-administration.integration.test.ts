import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testUrl = process.env.NEXTPRESS_CONTENT_TEST_DATABASE_URL;
let db: typeof import("@nextpress/db/src/client").prisma;
let administer: typeof import("./user-administration.server").administerUser;
const suffix = randomUUID();
const emails = [0, 1].map(
  (index) => `last-admin-${index}-${suffix}@example.invalid`,
);

describe.skipIf(!testUrl)("isolated last-administrator concurrency", () => {
  beforeAll(async () => {
    const url = new URL(testUrl ?? "");

    if (
      testUrl !== process.env.DATABASE_URL ||
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      !url.pathname.startsWith("/nextpress_phase1_verify")
    ) {
      throw new Error(
        "Use a matching disposable nextpress_phase1_verify* database",
      );
    }
    db = (await import("@nextpress/db/src/client")).prisma;
    administer = (await import("./user-administration.server")).administerUser;
    if (await db.user.count({ where: { role: { name: "ADMIN" } } })) {
      throw new Error(
        "Concurrency test requires a disposable database without administrators",
      );
    }
    for (const name of ["ADMIN", "EDITOR"]) {
      await db.role.upsert({ where: { name }, create: { name }, update: {} });
    }
  });

  afterAll(async () => {
    if (!db) return;
    await db.user.deleteMany({ where: { email: { in: emails } } });
    await db.$disconnect();
  });

  it("allows exactly one of concurrent deletion and demotion, then recovers", async () => {
    const users = await Promise.all(
      emails.map((email) =>
        db.user.create({
          data: { email, role: { connect: { name: "ADMIN" } } },
        }),
      ),
    );
    const first = users[0];
    const second = users[1];

    if (!first || !second) throw new Error("Missing fixtures");
    const results = await Promise.allSettled([
      administer({ id: first.id, role: "ADMIN" }, first.id, null),
      administer({ id: second.id, role: "ADMIN" }, second.id, "EDITOR"),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(await db.user.count({ where: { role: { name: "ADMIN" } } })).toBe(1);
    const remaining = await db.user.findFirstOrThrow({
      where: { role: { name: "ADMIN" } },
    });
    await expect(
      administer({ id: remaining.id, role: "ADMIN" }, remaining.id, "EDITOR"),
    ).rejects.toThrow();
    await expect(
      administer({ id: remaining.id, role: "SUBSCRIBER" }, remaining.id, null),
    ).rejects.toThrow("Forbidden");
    await expect(
      administer({ id: remaining.id, role: "ADMIN" }, remaining.id, "ADMIN"),
    ).resolves.toMatchObject({ id: remaining.id });
  });
});
