/*
  Warnings:

  - You are about to drop the column `pageId` on the `user_chapter_history` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "user_chapter_history" DROP COLUMN "pageId",
ADD COLUMN     "pageNumber" INTEGER;
