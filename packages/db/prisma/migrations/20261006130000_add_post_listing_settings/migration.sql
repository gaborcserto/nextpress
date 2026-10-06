-- CreateEnum
CREATE TYPE "PostListingMode" AS ENUM ('PAGINATION', 'LOAD_MORE');

-- AlterTable
ALTER TABLE "SiteSettings"
ADD COLUMN "postListingMode" "PostListingMode" NOT NULL DEFAULT 'PAGINATION',
ADD COLUMN "postsPerPage" INTEGER NOT NULL DEFAULT 10;

-- Keep invalid batch sizes out of persisted settings as a final safety boundary.
ALTER TABLE "SiteSettings"
ADD CONSTRAINT "SiteSettings_postsPerPage_range_check" CHECK ("postsPerPage" BETWEEN 1 AND 50);
