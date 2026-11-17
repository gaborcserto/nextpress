import "server-only";

import { disposableDatabaseName } from "./disposable-database";
import { verifyDisposableDatabase } from "./docker-database";
import {
  loadWorkingAggregate,
  saveWorkingAggregate,
} from "../services/working-aggregate-persistence.server";

import type { PrismaClient } from "@nextpress/db/generated/prisma/client";

import type { ContentActor } from "@/lib/auth/content-access";

async function verifyTarget(db: PrismaClient) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("WORKING_PERSISTENCE_NOT_ACTIVATED");
  }
  await verifyDisposableDatabase(
    disposableDatabaseName(
      process.env.NEXTPRESS_CONTENT_TEST_DATABASE_URL,
      process.env.DATABASE_URL,
      "content",
    ),
    db,
  );
}

/** Keep the original independent disposable identity admission for test callers. */
export async function loadDisposableWorkingAggregate(
  db: PrismaClient,
  pageId: string,
  actor: ContentActor,
) {
  await verifyTarget(db);

  return loadWorkingAggregate(db, pageId, actor);
}

export async function saveDisposableWorkingAggregate(
  db: PrismaClient,
  input: unknown,
  actor: ContentActor,
) {
  await verifyTarget(db);

  return saveWorkingAggregate(db, input, actor);
}
