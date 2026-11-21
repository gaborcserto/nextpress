CREATE TABLE "NavigationMenu" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0
);

CREATE TYPE "NavigationLocation" AS ENUM ('header', 'footer', 'sidebar');

CREATE TABLE "NavigationAssignment" (
  "location" "NavigationLocation" PRIMARY KEY,
  "menuId" TEXT NOT NULL REFERENCES "NavigationMenu"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "NavigationAssignment_menuId_idx" ON "NavigationAssignment"("menuId");

CREATE TYPE "NavigationItemKind" AS ENUM ('content', 'taxonomy', 'external', 'internal', 'group');

CREATE TABLE "NavigationItem" (
  "menuId" TEXT NOT NULL REFERENCES "NavigationMenu"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "id" TEXT NOT NULL,
  "parentId" TEXT,
  "position" INTEGER NOT NULL CHECK ("position" >= 0),
  "kind" "NavigationItemKind" NOT NULL,
  "value" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "newTab" BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY ("menuId", "id"),
  FOREIGN KEY ("menuId", "parentId") REFERENCES "NavigationItem"("menuId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CHECK ("parentId" IS DISTINCT FROM "id")
);
CREATE INDEX "NavigationItem_menuId_parentId_position_idx" ON "NavigationItem"("menuId", "parentId", "position");

INSERT INTO "NavigationMenu" ("id", "name") VALUES ('initial-header', 'Header'), ('initial-footer', 'Footer');
INSERT INTO "NavigationAssignment" VALUES ('header', 'initial-header'), ('footer', 'initial-footer');
INSERT INTO "NavigationItem" ("menuId", "id", "position", "kind", "value", "label")
VALUES ('initial-header', 'home', 0, 'internal', '/', ''), ('initial-header', 'posts', 1, 'internal', '/posts', '');
INSERT INTO "NavigationItem" ("menuId", "id", "position", "kind", "value", "label")
SELECT 'initial-header', "id", 1 + row_number() OVER (ORDER BY "title", "slug"), 'content', "id", ''
FROM "Page" WHERE "type" = 'PAGE' AND "inHeaderMenu" ORDER BY "title", "slug" LIMIT 198;
INSERT INTO "NavigationItem" ("menuId", "id", "position", "kind", "value", "label")
SELECT 'initial-footer', "id", row_number() OVER (ORDER BY "title", "slug") - 1, 'content', "id", ''
FROM "Page" WHERE "type" = 'PAGE' AND "inFooterMenu" ORDER BY "title", "slug" LIMIT 200;

ALTER TABLE "Page" ADD COLUMN "siblingOrder" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "Page_parentId_siblingOrder_id_idx" ON "Page"("parentId", "siblingOrder", "id");
ALTER TABLE "Page" DROP CONSTRAINT "Page_parentId_fkey",
  ADD CONSTRAINT "Page_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Page"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Page" ADD CONSTRAINT "Page_hierarchy_shape_check"
  CHECK ("siblingOrder" >= 0 AND ("parentId" IS NULL OR ("parentId" <> "id" AND "type" = 'PAGE' AND "layout" <> 'HOME')))
  NOT VALID;
