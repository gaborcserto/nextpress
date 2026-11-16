import { Client } from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { disposableDatabaseName } from "./disposable-database";
import { verifyDisposableDatabase } from "./docker-database";

const url = process.env.NEXTPRESS_CONTENT_TEST_DATABASE_URL;
const hash = "a".repeat(64);
let client: Client;
let db: typeof import("@nextpress/db/src/client").prisma;

describe.skipIf(!url)(
  "Editorial persistence constraints (synthetic snapshots, no services)",
  () => {
    beforeAll(async () => {
      const name = disposableDatabaseName(
        url,
        process.env.DATABASE_URL,
        "content",
      );
      db = (await import("@nextpress/db/src/client")).prisma;
      await verifyDisposableDatabase(name, db);
      client = new Client({ connectionString: url });
      await client.connect();
      const identity =
        await db.$queryRaw`SELECT current_database() AS name, nonce FROM b04_identity.marker`;
      expect(
        (
          await client.query(
            "SELECT current_database() AS name, nonce FROM b04_identity.marker",
          )
        ).rows,
      ).toEqual(identity);
    });

    beforeEach(async () => {
      await client.query("BEGIN");
      for (const page of ["b043-a", "b043-b"]) {
        await client.query(
          `INSERT INTO "Page" (id,type,slug,title,content,"updatedAt") VALUES ($1,'PAGE',$1,$1,'',now())`,
          [page],
        );
        await client.query(
          `INSERT INTO "ContentRevision" (id,"pageId",number,"schemaVersion",aggregate,coverage,"aggregateHash","createdAt",reason) VALUES ($1,$2,1,1,'{}','{}',$3,now(),'CREATE')`,
          [page + "-r", page, hash],
        );
        await client.query(
          `INSERT INTO "ContentEditorialState" ("pageId","contentVersion","nextRevisionNumber",visibility,"enrollmentState","enrollmentEpoch","updatedAt") VALUES ($1,0,2,'PRIVATE','SHADOW',0,now())`,
          [page],
        );
        await client.query(
          `INSERT INTO "ContentDraft" ("pageId","draftVersion","baseContentVersion","revisionId","updatedAt") VALUES ($1,0,0,$2,now())`,
          [page, page + "-r"],
        );
        await client.query(
          `INSERT INTO "ContentPublication" (id,"pageId","revisionId",generation,action,"committedAt","effectiveAt","operationId","enrollmentEpoch") VALUES ($1,$2,$3,1,'SCHEDULE',now(),now()+interval '1 day','00000000-0000-4000-8000-000000000001',0)`,
          [page + "-p", page, page + "-r"],
        );
        await client.query(
          `INSERT INTO "ContentEditLease" ("pageId",generation) VALUES ($1,0)`,
          [page],
        );
      }
    });

    afterEach(async () => {
      await client.query("ROLLBACK");
    });

    afterAll(async () => {
      if (client) {
        await client.end();
      }
      if (db) {
        await db.$disconnect();
      }
    });

    it.each([
      [
        "draft ownership",
        `UPDATE "ContentDraft" SET "revisionId"='b043-b-r' WHERE "pageId"='b043-a'`,
        "23503",
      ],
      [
        "live ownership",
        `UPDATE "ContentEditorialState" SET "liveRevisionId"='b043-b-r' WHERE "pageId"='b043-a'`,
        "23503",
      ],
      [
        "provenance ownership",
        `UPDATE "ContentRevision" SET "baseRevisionId"='b043-b-r' WHERE id='b043-a-r'`,
        "23503",
      ],
      [
        "revision deletion restriction",
        `DELETE FROM "ContentRevision" WHERE id='b043-a-r'`,
        "23001",
      ],
      [
        "identity deletion restriction",
        `DELETE FROM "Page" WHERE id='b043-a'`,
        "23001",
      ],
      [
        "revision sequence uniqueness",
        `INSERT INTO "ContentRevision" (id,"pageId",number,"schemaVersion",aggregate,coverage,"aggregateHash","createdAt",reason) SELECT 'duplicate',"pageId",number,"schemaVersion",aggregate,coverage,"aggregateHash","createdAt",reason FROM "ContentRevision" WHERE id='b043-a-r'`,
        "23505",
      ],
      [
        "lease slot uniqueness",
        `INSERT INTO "ContentEditLease" ("pageId",generation) VALUES ('b043-a',0)`,
        "23505",
      ],
      [
        "negative fence",
        `UPDATE "ContentEditLease" SET generation=-1 WHERE "pageId"='b043-a'`,
        "23514",
      ],
      [
        "BIGINT overflow",
        `UPDATE "ContentEditLease" SET generation=9223372036854775808 WHERE "pageId"='b043-a'`,
        "22003",
      ],
      [
        "partial held lease",
        `UPDATE "ContentEditLease" SET "tokenHash"='${hash}' WHERE "pageId"='b043-a'`,
        "23514",
      ],
    ])("rejects %s at the database", async (_name, statement, code) => {
      await expect(client.query(statement)).rejects.toMatchObject({ code });
    });

    it("rejects duplicate normalized slugs across content identities", async () => {
      await client.query(
        `INSERT INTO "ContentSlugReservation" VALUES ('reserved','b043-a',1,now())`,
      );
      await expect(
        client.query(
          `INSERT INTO "ContentSlugReservation" VALUES ('reserved','b043-b',1,now())`,
        ),
      ).rejects.toMatchObject({ code: "23505" });
    });

    it.each([
      [
        "Media",
        `INSERT INTO "Media" (id,url,mime) VALUES ('b043-target','/synthetic','image/png'); INSERT INTO "ContentRevisionMedia" VALUES ('b043-a-r','b043-target','COVER',0,'cover')`,
      ],
      [
        "Taxonomy",
        `INSERT INTO "Taxonomy" (id,type,slug,name) VALUES ('b043-target','TAG','b043-target','Synthetic'); INSERT INTO "ContentRevisionTaxonomy" VALUES ('b043-a-r','b043-target','TAG',0)`,
      ],
      [
        "Page",
        `INSERT INTO "Page" (id,type,slug,title,content,"updatedAt") VALUES ('b043-target','PAGE','b043-target','Synthetic','',now()); INSERT INTO "ContentRevisionPageReference" VALUES ('b043-a-r','b043-target','PARENT','parent')`,
      ],
    ])("protects retained %s references", async (table, setup) => {
      await client.query(setup);
      await expect(
        client.query(`DELETE FROM "${table}" WHERE id='b043-target'`),
      ).rejects.toMatchObject({ code: "23001" });
    });

    it("simulates optimistic draft and fencing predicates; the service must supply them", async () => {
      const draft = `UPDATE "ContentDraft" SET "draftVersion"="draftVersion"+1 WHERE "pageId"='b043-a' AND "draftVersion"=0`;
      expect((await client.query(draft)).rowCount).toBe(1);
      expect((await client.query(draft)).rowCount).toBe(0);
      const acquire = `UPDATE "ContentEditLease" SET generation=generation+1 WHERE "pageId"='b043-a' AND generation=0`;
      expect((await client.query(acquire)).rowCount).toBe(1);
      expect((await client.query(acquire)).rowCount).toBe(0);
      // Neither monotonic fencing nor append-only revisions is a CHECK constraint.
      expect(
        (
          await client.query(
            `UPDATE "ContentEditLease" SET generation=0 WHERE "pageId"='b043-a'`,
          )
        ).rowCount,
      ).toBe(1);
      expect(
        (
          await client.query(
            `UPDATE "ContentRevision" SET aggregate='{"changed":true}' WHERE id='b043-a-r'`,
          )
        ).rowCount,
      ).toBe(1);
    });

    it("rolls back draft work when a dependent reference fails", async () => {
      await client.query("SAVEPOINT mutation");
      await client.query(
        `UPDATE "ContentDraft" SET "draftVersion"=5 WHERE "pageId"='b043-a'`,
      );
      await expect(
        client.query(
          `INSERT INTO "ContentSlugReservation" VALUES ('invalid','missing',1,now())`,
        ),
      ).rejects.toMatchObject({ code: "23503" });
      await client.query("ROLLBACK TO SAVEPOINT mutation");
      expect(
        (
          await client.query(
            `SELECT "draftVersion" FROM "ContentDraft" WHERE "pageId"='b043-a'`,
          )
        ).rows,
      ).toEqual([{ draftVersion: 0 }]);
    });

    it("deduplicates actor/kind/UUID even without a page locator", async () => {
      const insert = `INSERT INTO "EditorialOperation" ("actorKey",operation,"operationId","requestHash","createdAt") VALUES ('synthetic','SAVE','00000000-0000-4000-8000-000000000001','${hash}',now())`;
      await client.query(insert);
      await expect(client.query(insert)).rejects.toMatchObject({
        code: "23505",
      });
    });

    it("reconciles validated constraint and explicit index coverage", async () => {
      const constraints = await client.query<{
        count: number;
        validated: boolean;
      }>(
        `SELECT count(*)::int AS count,bool_and(convalidated) AS validated FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype <> 'n' AND conrelid IN (SELECT oid FROM pg_class WHERE relname LIKE 'Content%' OR relname='EditorialOperation')`,
      );
      expect(constraints.rows).toEqual([{ count: 86, validated: true }]);
      const indexes = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM pg_indexes WHERE schemaname='public' AND (tablename LIKE 'Content%' OR tablename='EditorialOperation') AND indexname NOT LIKE '%_pkey'`,
      );
      expect(indexes.rows).toEqual([{ count: 24 }]);
    });
  },
);
