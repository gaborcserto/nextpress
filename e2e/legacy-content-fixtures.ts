import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

import {
  developmentPages,
  serializeDevelopmentContent,
} from "../packages/db/prisma/development-content";

async function prepareLegacyContent() {
  const url = new URL(process.env.DATABASE_URL ?? "");

  if (
    url.hostname !== "localhost" ||
    url.port !== "55441" ||
    url.pathname !== "/nextpress_e2e"
  ) {
    throw new Error(
      "Legacy migration fixtures require the disposable E2E database",
    );
  }
  const mode = process.argv[2];
  const evidencePath = process.argv[3];
  assert.ok(evidencePath && ["before", "after"].includes(mode ?? ""));
  const { prisma } = await import("@nextpress/db/src/client");

  try {
    if (mode === "before") {
      const columns = await prisma.$queryRaw<{ count: number }[]>`
        SELECT count(*)::integer AS count FROM information_schema.columns
        WHERE table_schema='public' AND table_name IN ('Page','PageRevision')
          AND column_name IN ('pageDocument','workingVersion')`;
      assert.equal(columns[0]?.count, 0);
      for (const page of developmentPages) {
        const { content, excerpt } = serializeDevelopmentContent(page);
        await prisma.$executeRaw`
          INSERT INTO "Page" (id,type,status,slug,title,content,excerpt,"publishedAt","updatedAt","inHeaderMenu","inFooterMenu")
          VALUES (${page.id},${page.type}::"PageType",${page.status}::"PublishStatus",${page.slug},${page.title},${content},${excerpt},${page.publishedAt},NOW(),${page.inHeaderMenu ?? false},${page.inFooterMenu ?? false})`;
      }
      for (const [id, type, content] of [
        [
          "legacy-slate-page",
          "PAGE",
          '[{"type":"paragraph","children":[{"text":"Legacy Slate body"}]}]',
        ],
        [
          "legacy-plain-post",
          "POST",
          "Legacy literal <script>text</script> body",
        ],
        ["legacy-empty-page", "PAGE", ""],
      ]) {
        await prisma.$executeRaw`
          INSERT INTO "Page" (id,type,status,slug,title,content,excerpt,"publishedAt","updatedAt")
          VALUES (${id},${type}::"PageType",'PUBLISHED',${id},${id},${content},NULL,'2025-01-01',NOW())`;
      }
    }

    const fingerprint = await prisma.$queryRaw<
      { count: number; fingerprint: string }[]
    >`
      SELECT count(*)::integer AS count,
        md5(string_agg((to_jsonb(p)-'pageDocument'-'workingVersion')::text,'' ORDER BY id)) AS fingerprint
      FROM "Page" p`;

    if (mode === "before") {
      await writeFile(evidencePath, JSON.stringify(fingerprint));
      console.log(
        `Prepared ${fingerprint[0]?.count} legacy records before the composition migration`,
      );
    } else {
      assert.deepEqual(
        fingerprint,
        JSON.parse(await readFile(evidencePath, "utf8")),
      );
      const pages = await prisma.page.findMany();
      assert.ok(
        pages.every(
          (page) => page.workingVersion === 0 && page.pageDocument === null,
        ),
      );
      assert.equal(await prisma.pageRevision.count(), 0);
      console.log(
        `Upgrade preserved all fields of ${pages.length} legacy records; zero versions, null composition, no revisions`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

prepareLegacyContent().catch((error: unknown) => {
  console.error("Disposable legacy migration fixture failed", error);
  process.exitCode = 1;
});
