-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "disqusEmbedUrl" TEXT,
ADD COLUMN     "enableDisqusIntegration" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enableGoogleAds" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "user_chapter_history" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "chapterId" INTEGER NOT NULL,
    "pageId" INTEGER,
    "startedAt" TIMESTAMP(3),
    "lastReadAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_chapter_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_chapter_history_chapterId_userId_key" ON "user_chapter_history"("chapterId", "userId");

-- AddForeignKey
ALTER TABLE "user_chapter_history" ADD CONSTRAINT "user_chapter_history_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_chapter_history" ADD CONSTRAINT "user_chapter_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
