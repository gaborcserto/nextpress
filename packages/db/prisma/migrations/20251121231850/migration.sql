-- CreateEnum
CREATE TYPE "PageLayout" AS ENUM ('STANDARD', 'HOMEPAGE', 'LISTING', 'GALLERY', 'CONTACT', 'LANDING', 'REDIRECT', 'DOWNLOAD', 'CATEGORY_PAGE', 'EVENT_PAGE');

-- CreateEnum
CREATE TYPE "ListingKind" AS ENUM ('POSTS', 'PRODUCTS', 'EVENTS');

-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "eventEnd" TIMESTAMP(3),
ADD COLUMN     "eventLocation" TEXT,
ADD COLUMN     "eventStart" TIMESTAMP(3),
ADD COLUMN     "inFooterMenu" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inHeaderMenu" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastViewedAt" TIMESTAMP(3),
ADD COLUMN     "layout" "PageLayout" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "likeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "listingKind" "ListingKind",
ADD COLUMN     "listingTaxonomyId" TEXT,
ADD COLUMN     "redirectTo" TEXT,
ADD COLUMN     "registrationUrl" TEXT,
ADD COLUMN     "uniqueViewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PageRevision" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "authorId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "layout" "PageLayout" NOT NULL,
    "status" "PublishStatus" NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PageRevision_pageId_createdAt_idx" ON "PageRevision"("pageId", "createdAt");

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_listingTaxonomyId_fkey" FOREIGN KEY ("listingTaxonomyId") REFERENCES "Taxonomy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageRevision" ADD CONSTRAINT "PageRevision_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageRevision" ADD CONSTRAINT "PageRevision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
