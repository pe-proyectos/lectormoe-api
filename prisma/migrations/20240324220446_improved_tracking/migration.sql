/*
  Warnings:

  - Added the required column `imageHeight` to the `page` table without a default value. This is not possible if the table is not empty.
  - Added the required column `imageType` to the `page` table without a default value. This is not possible if the table is not empty.
  - Added the required column `imageWidth` to the `page` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "chapter" ADD COLUMN     "views" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "manga_custom" ADD COLUMN     "views" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "bannerUrl" TEXT,
ADD COLUMN     "discordUrl" TEXT,
ADD COLUMN     "facebookUrl" TEXT,
ADD COLUMN     "instagramUrl" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "patreonUrl" TEXT,
ADD COLUMN     "tiktokUrl" TEXT,
ADD COLUMN     "twitchUrl" TEXT,
ADD COLUMN     "twitterUrl" TEXT,
ADD COLUMN     "youtubeUrl" TEXT,
ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "imageUrl" DROP NOT NULL;

-- AlterTable
ALTER TABLE "page" ADD COLUMN     "imageHeight" INTEGER NOT NULL,
ADD COLUMN     "imageType" VARCHAR(256) NOT NULL,
ADD COLUMN     "imageWidth" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "analytics" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER,
    "userId" INTEGER,
    "path" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "browser" TEXT,
    "language" TEXT,
    "deviceType" TEXT,
    "trafficSource" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "analytics_organizationId_userId_key" ON "analytics"("organizationId", "userId");

-- AddForeignKey
ALTER TABLE "analytics" ADD CONSTRAINT "analytics_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics" ADD CONSTRAINT "analytics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
