/*
  Warnings:

  - A unique constraint covering the columns `[organizationId,slug]` on the table `genre` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `organizationId` to the `genre` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "genre_name_key";

-- DropIndex
DROP INDEX "genre_slug_key";

-- AlterTable
ALTER TABLE "author" ALTER COLUMN "shortDescription" SET DATA TYPE VARCHAR(300);

-- AlterTable
ALTER TABLE "chapter" ADD COLUMN     "isSubscription" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "genre" ADD COLUMN     "organizationId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "manga" ALTER COLUMN "shortDescription" SET DATA TYPE VARCHAR(300);

-- AlterTable
ALTER TABLE "manga_custom" ADD COLUMN     "isSubscription" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastChapterAt" TIMESTAMP(3),
ADD COLUMN     "status" VARCHAR(256) NOT NULL DEFAULT 'ongoing',
ADD COLUMN     "visibility" VARCHAR(256) NOT NULL DEFAULT 'public',
ALTER COLUMN "shortDescription" SET DATA TYPE VARCHAR(300);

-- CreateTable
CREATE TABLE "subscription" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "message" TEXT,
    "expiresAt" TIMESTAMP NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "slug" VARCHAR(256) NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "content" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "action" VARCHAR(256) NOT NULL,
    "payload" JSONB,
    "ip" TEXT NOT NULL,
    "browser" TEXT,
    "language" TEXT,
    "device" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "views" (
    "id" SERIAL NOT NULL,
    "mangaCustomId" INTEGER,
    "chapterId" INTEGER,
    "ip" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_organizationId_userId_key" ON "subscription"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "news_memberId_slug_key" ON "news"("memberId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "genre_organizationId_slug_key" ON "genre"("organizationId", "slug");

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "genre" ADD CONSTRAINT "genre_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit" ADD CONSTRAINT "audit_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "views" ADD CONSTRAINT "views_mangaCustomId_fkey" FOREIGN KEY ("mangaCustomId") REFERENCES "manga_custom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "views" ADD CONSTRAINT "views_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
