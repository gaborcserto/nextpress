import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { disposableDatabaseName } from "./disposable-database";
import {
  readDisposableManifest,
  verifyDisposableDatabase,
} from "./docker-database";

const url = process.env.NEXTPRESS_CONTENT_TEST_DATABASE_URL;
let db: typeof import("@nextpress/db/src/client").prisma;

function barrier() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });

  return { promise, release };
}

function errorCodes(error: unknown): string[] {
  if (typeof error !== "object" || error === null) {
    return [];
  }

  return Object.entries(error).flatMap(([key, value]) => {
    if (
      ["code", "originalCode", "sqlState"].includes(key) &&
      typeof value === "string"
    ) {
      return [value];
    }

    return errorCodes(value);
  });
}

describe.skipIf(!url)(
  "PostgreSQL transaction and lease primitives (no production models)",
  () => {
    beforeAll(async () => {
      const name = disposableDatabaseName(
        url,
        process.env.DATABASE_URL,
        "content",
      );
      const candidate = (await import("@nextpress/db/src/client")).prisma;
      await verifyDisposableDatabase(name, candidate);
      db = candidate;
      await db.$executeRaw`CREATE TABLE b04_lease_probe (
      id integer PRIMARY KEY, generation bigint NOT NULL CHECK (generation >= 0),
      holder text, renewed_at timestamptz(3), expires_at timestamptz(3),
      CHECK ((holder IS NULL AND renewed_at IS NULL AND expires_at IS NULL) OR
        (holder IS NOT NULL AND renewed_at IS NOT NULL AND expires_at IS NOT NULL AND
        expires_at > renewed_at AND expires_at <= renewed_at + interval '120 seconds'))
    )`;
    });

    afterAll(async () => {
      if (db) {
        await verifyDisposableDatabase(
          disposableDatabaseName(url, process.env.DATABASE_URL, "content"),
          db,
        );
        await db.$executeRaw`DROP TABLE b04_lease_probe`;
        await db.$disconnect();
      }
    });

    it("measures isolation and database clocks; advisory xact locks release on rollback", async () => {
      const held = barrier();
      const release = barrier();
      const transaction = db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(404041)`;
        const [clock] = await tx.$queryRaw<
          {
            isolation: string;
            stable: boolean;
            advancing: boolean;
            started: string;
          }[]
        >`
        SELECT current_setting('transaction_isolation') AS isolation,
        now() = transaction_timestamp() AS stable, clock_timestamp() >= now() AS advancing, now()::text AS started`;
        expect(clock).toMatchObject({
          isolation: "read committed",
          stable: true,
          advancing: true,
        });
        held.release();
        await release.promise;
        expect(
          await tx.$queryRaw`SELECT now() = ${clock?.started}::timestamptz AS stable,
          clock_timestamp() > ${clock?.started}::timestamptz AS advanced`,
        ).toEqual([{ stable: true, advanced: true }]);
        throw new Error("rollback probe");
      });
      const rejected = expect(transaction).rejects.toThrow("rollback probe");

      try {
        await held.promise;
        await db.$transaction(async (tx) => {
          expect(
            await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(404041) AS acquired`,
          ).toEqual([{ acquired: false }]);
        });
      } finally {
        release.release();
      }
      await rejected;
      expect(
        await db.$queryRaw`SELECT pg_try_advisory_xact_lock(404041) AS acquired`,
      ).toEqual([{ acquired: true }]);
    });

    it("atomically acquires one slot and permits only one generation-checked takeover", async () => {
      const acquire = (holder: string) => db.$queryRaw<
        { generation: bigint }[]
      >`
      INSERT INTO b04_lease_probe VALUES (1,9007199254740993,${holder},clock_timestamp(),clock_timestamp()+interval '60 seconds')
      ON CONFLICT (id) DO UPDATE SET generation=b04_lease_probe.generation+1, holder=EXCLUDED.holder,
      renewed_at=EXCLUDED.renewed_at, expires_at=EXCLUDED.expires_at
      WHERE b04_lease_probe.expires_at <= clock_timestamp() RETURNING generation`;
      const acquired = await Promise.all([acquire("tab-a"), acquire("tab-b")]);
      expect(acquired.map((rows) => rows.length).sort()).toEqual([0, 1]);

      const takeover = (holder: string) => db.$queryRaw<
        { generation: bigint }[]
      >`
      UPDATE b04_lease_probe SET generation=generation+1, holder=${holder}
      WHERE id=1 AND generation=9007199254740993 RETURNING generation`;
      const results = await Promise.all([takeover("tab-c"), takeover("tab-d")]);
      expect(results.flat()).toEqual([{ generation: 9007199254740994n }]);
      expect(await takeover("stale")).toEqual([]);
      await db.$executeRaw`UPDATE b04_lease_probe SET renewed_at=clock_timestamp()-interval '2 seconds',
        expires_at=clock_timestamp()-interval '1 second' WHERE id=1`;
      const reclaimed = await Promise.all([
        acquire("reclaim-a"),
        acquire("reclaim-b"),
      ]);
      expect(reclaimed.flat()).toEqual([{ generation: 9007199254740995n }]);
      await expect(
        db.$executeRaw`UPDATE b04_lease_probe SET generation=9223372036854775807 WHERE id=1`,
      ).resolves.toBe(1);
      await expect(
        db.$executeRaw`UPDATE b04_lease_probe SET generation=generation+1 WHERE id=1`,
      ).rejects.toMatchObject({ code: "P2010" });
      await expect(
        db.$executeRaw`INSERT INTO b04_lease_probe VALUES (2,-1,NULL,NULL,NULL)`,
      ).rejects.toMatchObject({ code: "P2010" });
      await expect(
        db.$executeRaw`INSERT INTO b04_lease_probe VALUES (2,0,'bad',now(),now()+interval '121 seconds')`,
      ).rejects.toMatchObject({ code: "P2010" });
    });

    it("observes Serializable 40001 mapping and rolls back the losing transaction", async () => {
      await db.$executeRaw`INSERT INTO b04_lease_probe VALUES (3,0,NULL,NULL,NULL)`;
      const read = barrier();
      const committed = barrier();
      const losing = db.$transaction(
        async (tx) => {
          expect(await tx.$queryRaw`SHOW transaction_isolation`).toEqual([
            { transaction_isolation: "serializable" },
          ]);
          await tx.$queryRaw`SELECT generation FROM b04_lease_probe WHERE id=3`;
          read.release();
          await committed.promise;
          await tx.$executeRaw`UPDATE b04_lease_probe SET generation=generation+1 WHERE id=3`;
        },
        { isolationLevel: "Serializable", timeout: 10000 },
      );
      const outcome = losing.catch((error: unknown) => error);
      await read.promise;
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`UPDATE b04_lease_probe SET generation=generation+1 WHERE id=3`;
      });
      committed.release();
      const codes = errorCodes(await outcome);
      console.log("Serializable error codes", codes);
      expect(codes).toContain("40001");
      expect(codes).toContain("P2010");
      expect(
        await db.$queryRaw`SELECT generation FROM b04_lease_probe WHERE id=3`,
      ).toEqual([{ generation: 1n }]);
    });
    it("rejects mismatched live identity evidence before mutation", async () => {
      const manifest = readDisposableManifest();

      for (const [field, value] of Object.entries({
        database: "nextpress_phase1_verify_000000000000",
        cluster: "1",
        nonce: "0".repeat(64),
        container: "0".repeat(64),
        network: "0".repeat(64),
        port: 5432,
        address: "10.0.0.1",
      })) {
        await expect(
          verifyDisposableDatabase(
            disposableDatabaseName(url, process.env.DATABASE_URL, "content"),
            db,
            { ...manifest, [field]: value },
          ),
        ).rejects.toThrow();
      }
      for (const replacement of [
        "cms",
        "wrong",
        "role",
        "remote",
        "port",
        "query",
      ]) {
        const changed = new URL(url ?? "");

        if (replacement === "role") {
          changed.username = "b04_provisioner";
        } else if (replacement === "remote") {
          changed.hostname = "remote.invalid";
        } else if (replacement === "port") {
          changed.port = "5432";
        } else if (replacement === "query") {
          changed.search = "host=remote.invalid";
        } else {
          changed.pathname = `/${replacement}`;
        }
        expect(() =>
          disposableDatabaseName(url, changed.toString(), "content"),
        ).toThrow();
      }
      const privilegedUrl = new URL(url ?? "");
      privilegedUrl.username = "b04_provisioner";

      try {
        vi.stubEnv("DATABASE_URL", privilegedUrl.toString());
        await expect(
          verifyDisposableDatabase(
            disposableDatabaseName(url, url, "content"),
            db,
          ),
        ).rejects.toThrow();
      } finally {
        vi.unstubAllEnvs();
      }
      await verifyDisposableDatabase(
        disposableDatabaseName(url, process.env.DATABASE_URL, "content"),
        db,
      );
    });

    it("maps an advisory-lock deadlock to SQLSTATE 40P01 and P2010", async () => {
      const first = barrier();
      const second = barrier();

      const transaction = (
        own: number,
        other: number,
        held: ReturnType<typeof barrier>,
        peer: ReturnType<typeof barrier>,
      ) =>
        db.$transaction(
          async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(${own}::bigint)`;
            held.release();
            await peer.promise;
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(${other}::bigint)`;
          },
          { timeout: 10000 },
        );
      const outcomes = await Promise.allSettled([
        transaction(404042, 404043, first, second),
        transaction(404043, 404042, second, first),
      ]);
      expect(
        outcomes.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      const rejected = outcomes.find((result) => result.status === "rejected");
      expect(errorCodes(rejected?.reason)).toEqual(
        expect.arrayContaining(["P2010", "40P01"]),
      );
    });

    it("maps a Prisma model Serializable write conflict to P2034", async () => {
      const role = await db.role.create({ data: { name: "B04_SERIALIZABLE" } });
      const read = barrier();
      const committed = barrier();
      const losing = db.$transaction(
        async (tx) => {
          await tx.role.findUniqueOrThrow({ where: { id: role.id } });
          read.release();
          await committed.promise;
          await tx.role.update({
            where: { id: role.id },
            data: { name: "B04_LOSER" },
          });
        },
        { isolationLevel: "Serializable", timeout: 10000 },
      );
      const outcome = losing.catch((error: unknown) => error);

      try {
        await read.promise;
        await db.role.update({
          where: { id: role.id },
          data: { name: "B04_WINNER" },
        });
        committed.release();
        expect(errorCodes(await outcome)).toContain("P2034");
        expect(
          await db.role.findUniqueOrThrow({ where: { id: role.id } }),
        ).toMatchObject({ name: "B04_WINNER" });
      } finally {
        committed.release();
        await outcome;
        await db.role.delete({ where: { id: role.id } });
      }
    });
  },
);
