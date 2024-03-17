/*
  Warnings:

  - You are about to drop the column `mangaId` on the `chapter` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `chapter` table. All the data in the column will be lost.
  - You are about to drop the column `authorId` on the `manga` table. All the data in the column will be lost.
  - You are about to drop the column `mangaId` on the `ranking` table. All the data in the column will be lost.
  - You are about to drop the `_GenreToManga` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_MangaToUser` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[number,mangaCustomId]` on the table `chapter` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[number,chapterId]` on the table `page` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `mangaCustomId` to the `chapter` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mangaCustomId` to the `ranking` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "_GenreToManga" DROP CONSTRAINT "_GenreToManga_A_fkey";

-- DropForeignKey
ALTER TABLE "_GenreToManga" DROP CONSTRAINT "_GenreToManga_B_fkey";

-- DropForeignKey
ALTER TABLE "_MangaToUser" DROP CONSTRAINT "_MangaToUser_A_fkey";

-- DropForeignKey
ALTER TABLE "_MangaToUser" DROP CONSTRAINT "_MangaToUser_B_fkey";

-- DropForeignKey
ALTER TABLE "chapter" DROP CONSTRAINT "chapter_mangaId_fkey";

-- DropForeignKey
ALTER TABLE "manga" DROP CONSTRAINT "manga_authorId_fkey";

-- DropForeignKey
ALTER TABLE "ranking" DROP CONSTRAINT "ranking_mangaId_fkey";

-- DropIndex
DROP INDEX "chapter_slug_mangaId_key";

-- AlterTable
ALTER TABLE "chapter" DROP COLUMN "mangaId",
DROP COLUMN "slug",
ADD COLUMN     "mangaCustomId" INTEGER NOT NULL,
ALTER COLUMN "imageUrl" DROP NOT NULL;

-- AlterTable
ALTER TABLE "manga" DROP COLUMN "authorId",
ALTER COLUMN "imageUrl" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ranking" DROP COLUMN "mangaId",
ADD COLUMN     "mangaCustomId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "_GenreToManga";

-- DropTable
DROP TABLE "_MangaToUser";

-- CreateTable
CREATE TABLE "organization" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "domain" VARCHAR(256) NOT NULL,
    "slug" VARCHAR(256) NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" VARCHAR(256) NOT NULL,
    "description" TEXT NOT NULL,
    "canEditOrganization" BOOLEAN NOT NULL DEFAULT false,
    "canDeleteOrganization" BOOLEAN NOT NULL DEFAULT false,
    "canInviteMember" BOOLEAN NOT NULL DEFAULT false,
    "canEditMember" BOOLEAN NOT NULL DEFAULT false,
    "canDeleteMember" BOOLEAN NOT NULL DEFAULT false,
    "canUploadManga" BOOLEAN NOT NULL DEFAULT false,
    "canEditManga" BOOLEAN NOT NULL DEFAULT false,
    "canDeleteManga" BOOLEAN NOT NULL DEFAULT false,
    "canUploadChapter" BOOLEAN NOT NULL DEFAULT false,
    "canEditChapter" BOOLEAN NOT NULL DEFAULT false,
    "canDeleteChapter" BOOLEAN NOT NULL DEFAULT false,
    "canUploadPage" BOOLEAN NOT NULL DEFAULT false,
    "canEditPage" BOOLEAN NOT NULL DEFAULT false,
    "canDeletePage" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manga_custom" (
    "id" SERIAL NOT NULL,
    "mangaId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "shortDescription" VARCHAR(256) NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "nextChapterAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manga_custom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AuthorToManga" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_GenreToMangaCustom" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_name_key" ON "organization"("name");

-- CreateIndex
CREATE UNIQUE INDEX "organization_title_key" ON "organization"("title");

-- CreateIndex
CREATE UNIQUE INDEX "organization_domain_key" ON "organization"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "member_organizationId_userId_key" ON "member"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "manga_custom_mangaId_organizationId_key" ON "manga_custom"("mangaId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "_AuthorToManga_AB_unique" ON "_AuthorToManga"("A", "B");

-- CreateIndex
CREATE INDEX "_AuthorToManga_B_index" ON "_AuthorToManga"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_GenreToMangaCustom_AB_unique" ON "_GenreToMangaCustom"("A", "B");

-- CreateIndex
CREATE INDEX "_GenreToMangaCustom_B_index" ON "_GenreToMangaCustom"("B");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_number_mangaCustomId_key" ON "chapter"("number", "mangaCustomId");

-- CreateIndex
CREATE UNIQUE INDEX "page_number_chapterId_key" ON "page"("number", "chapterId");

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manga_custom" ADD CONSTRAINT "manga_custom_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "manga"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manga_custom" ADD CONSTRAINT "manga_custom_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_mangaCustomId_fkey" FOREIGN KEY ("mangaCustomId") REFERENCES "manga_custom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking" ADD CONSTRAINT "ranking_mangaCustomId_fkey" FOREIGN KEY ("mangaCustomId") REFERENCES "manga_custom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AuthorToManga" ADD CONSTRAINT "_AuthorToManga_A_fkey" FOREIGN KEY ("A") REFERENCES "author"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AuthorToManga" ADD CONSTRAINT "_AuthorToManga_B_fkey" FOREIGN KEY ("B") REFERENCES "manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GenreToMangaCustom" ADD CONSTRAINT "_GenreToMangaCustom_A_fkey" FOREIGN KEY ("A") REFERENCES "genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GenreToMangaCustom" ADD CONSTRAINT "_GenreToMangaCustom_B_fkey" FOREIGN KEY ("B") REFERENCES "manga_custom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
