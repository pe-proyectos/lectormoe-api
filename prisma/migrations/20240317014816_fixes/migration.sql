-- AlterTable
ALTER TABLE "author" ALTER COLUMN "shortDescription" DROP NOT NULL,
ALTER COLUMN "description" DROP NOT NULL;

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "googleAdsMetaContent" TEXT;
