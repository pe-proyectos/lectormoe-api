/*
  Warnings:

  - A unique constraint covering the columns `[slug,mangaId]` on the table `chapter` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "chapter_slug_key";

-- CreateIndex
CREATE UNIQUE INDEX "chapter_slug_mangaId_key" ON "chapter"("slug", "mangaId");
