-- AlterTable: add hideUnreleasedChapters to manga_custom
ALTER TABLE "manga_custom" ADD COLUMN "hideUnreleasedChapters" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: user_page_bookmark
CREATE TABLE "user_page_bookmark" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "chapterId" INTEGER NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "note" VARCHAR(256),
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_page_bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique per user+chapter+page
CREATE UNIQUE INDEX "user_page_bookmark_userId_chapterId_pageNumber_key" ON "user_page_bookmark"("userId", "chapterId", "pageNumber");

-- CreateIndex: user+order for ordered listing
CREATE INDEX "user_page_bookmark_userId_order_idx" ON "user_page_bookmark"("userId", "order");

-- AddForeignKey: user_page_bookmark -> user
ALTER TABLE "user_page_bookmark" ADD CONSTRAINT "user_page_bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: user_page_bookmark -> chapter
ALTER TABLE "user_page_bookmark" ADD CONSTRAINT "user_page_bookmark_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
