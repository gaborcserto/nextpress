-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "colorMode" TEXT NOT NULL DEFAULT 'light',
ADD COLUMN     "stylePreset" TEXT NOT NULL DEFAULT 'classic',
ADD COLUMN     "websiteTemplate" TEXT NOT NULL DEFAULT 'blog';
