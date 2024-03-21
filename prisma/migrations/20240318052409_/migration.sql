/*
  Warnings:

  - You are about to drop the column `canDeleteManga` on the `member` table. All the data in the column will be lost.
  - You are about to drop the column `canEditManga` on the `member` table. All the data in the column will be lost.
  - You are about to drop the column `canUploadChapter` on the `member` table. All the data in the column will be lost.
  - You are about to drop the column `canUploadManga` on the `member` table. All the data in the column will be lost.
  - You are about to drop the column `canUploadPage` on the `member` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "author" ALTER COLUMN "imageUrl" DROP NOT NULL;

-- AlterTable
ALTER TABLE "manga" ALTER COLUMN "shortDescription" DROP NOT NULL,
ALTER COLUMN "description" DROP NOT NULL;

-- AlterTable
ALTER TABLE "manga_custom" ALTER COLUMN "shortDescription" DROP NOT NULL,
ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "imageUrl" DROP NOT NULL;

-- AlterTable
ALTER TABLE "member" DROP COLUMN "canDeleteManga",
DROP COLUMN "canEditManga",
DROP COLUMN "canUploadChapter",
DROP COLUMN "canUploadManga",
DROP COLUMN "canUploadPage",
ADD COLUMN     "canCreateAuthor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canCreateChapter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canCreateGenre" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canCreateMangaCustom" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canCreateMangaProfile" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canCreatePage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canDeleteGenre" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canDeleteMangaCustom" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canEditGenre" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canEditMangaCustom" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hierarchyLevel" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "description" DROP NOT NULL;
