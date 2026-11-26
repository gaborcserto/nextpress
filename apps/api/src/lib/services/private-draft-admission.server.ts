import "server-only";

import { verifyBackfillDatabase } from "./legacy-backfill/legacy-backfill-fence.server";

import type { PrismaClient } from "@nextpress/db/generated/prisma/client";

export class PrivateDraftUnavailableError extends Error {}

/** Development rehearsal only. Production admission requires the remaining NP-01C evidence. */
export async function requirePrivateDraftAdmission(db: PrismaClient) {
  if (
    !["development", "test"].includes(process.env.NODE_ENV ?? "") ||
    process.env.NEXTPRESS_PRIVATE_DRAFT_REHEARSAL !== "enabled"
  ) {
    throw new PrivateDraftUnavailableError();
  }

  try {
    // Checks the independently configured database, cluster and nonprivileged role.
    // This is read-only; it neither claims maintenance nor enrolls SHADOW records.
    await verifyBackfillDatabase(db);
    const [privileges] = await db.$queryRaw<{ ready: boolean }[]>`
      SELECT (
        (SELECT count(*) = 5 AND bool_and(
          has_table_privilege(c.oid, 'SELECT') AND has_table_privilege(c.oid, 'INSERT') AND
          (c.relname <> 'NPContentFence' OR has_table_privilege(c.oid, 'UPDATE'))
        ) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname IN (
            'NPContentFence','NPWorkingRevision','NPWorkingMedia','NPWorkingTaxonomy','NPWorkingPage'
          ))
        AND NOT EXISTS (
          SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname IN (
            'Page','PageRevision','PageOnTaxonomy','PageMedia','Media','Taxonomy','User',
            'NPContentFence','NPWorkingRevision','NPWorkingMedia','NPWorkingTaxonomy','NPWorkingPage',
            'LegacyBackfillFence','ContentEditorialState'
          ) AND pg_has_role(c.relowner, 'MEMBER')
        )
        AND NOT has_schema_privilege('public', 'CREATE')
      ) AS ready`;

    if (!privileges?.ready) {
      throw new PrivateDraftUnavailableError();
    }
  } catch {
    throw new PrivateDraftUnavailableError();
  }
}
