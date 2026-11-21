ALTER TABLE "Media"
  ADD COLUMN "filename" TEXT,
  ADD COLUMN "originalMime" TEXT,
  ADD COLUMN "size" INTEGER,
  ADD COLUMN "caption" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3);

ALTER TABLE "Page" DROP CONSTRAINT "Page_coverId_fkey",
  ADD CONSTRAINT "Page_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PageMedia" DROP CONSTRAINT "PageMedia_mediaId_fkey",
  ADD CONSTRAINT "PageMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
