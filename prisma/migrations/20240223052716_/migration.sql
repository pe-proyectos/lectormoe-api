-- CreateTable
CREATE TABLE "token" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(256) NOT NULL,
    "slug" VARCHAR(256) NOT NULL,
    "email" VARCHAR(256) NOT NULL,
    "password" VARCHAR(256) NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "author" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "slug" VARCHAR(256) NOT NULL,
    "shortDescription" VARCHAR(256) NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manga" (
    "id" SERIAL NOT NULL,
    "authorId" INTEGER NOT NULL,
    "demographyId" INTEGER NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "slug" VARCHAR(256) NOT NULL,
    "shortDescription" VARCHAR(256) NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "nextChapterAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter" (
    "id" SERIAL NOT NULL,
    "mangaId" INTEGER NOT NULL,
    "slug" VARCHAR(256) NOT NULL,
    "number" INTEGER NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "imageUrl" VARCHAR(256) NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page" (
    "id" SERIAL NOT NULL,
    "chapterId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranking" (
    "id" SERIAL NOT NULL,
    "mangaId" INTEGER NOT NULL,
    "userId" INTEGER,
    "rank" CHAR(1) NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ranking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demography" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "slug" VARCHAR(256) NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demography_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genre" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "nameEs" VARCHAR(256) NOT NULL,
    "slug" VARCHAR(256) NOT NULL,
    "description" TEXT NOT NULL,
    "display" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "genre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MangaToUser" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_GenreToManga" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_slug_key" ON "user"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "author_name_key" ON "author"("name");

-- CreateIndex
CREATE UNIQUE INDEX "author_slug_key" ON "author"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "manga_title_key" ON "manga"("title");

-- CreateIndex
CREATE UNIQUE INDEX "manga_slug_key" ON "manga"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_slug_key" ON "chapter"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "demography_name_key" ON "demography"("name");

-- CreateIndex
CREATE UNIQUE INDEX "demography_slug_key" ON "demography"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "genre_name_key" ON "genre"("name");

-- CreateIndex
CREATE UNIQUE INDEX "genre_slug_key" ON "genre"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "_MangaToUser_AB_unique" ON "_MangaToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_MangaToUser_B_index" ON "_MangaToUser"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_GenreToManga_AB_unique" ON "_GenreToManga"("A", "B");

-- CreateIndex
CREATE INDEX "_GenreToManga_B_index" ON "_GenreToManga"("B");

-- AddForeignKey
ALTER TABLE "token" ADD CONSTRAINT "token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manga" ADD CONSTRAINT "manga_demographyId_fkey" FOREIGN KEY ("demographyId") REFERENCES "demography"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manga" ADD CONSTRAINT "manga_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "author"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "manga"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page" ADD CONSTRAINT "page_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking" ADD CONSTRAINT "ranking_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "manga"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking" ADD CONSTRAINT "ranking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MangaToUser" ADD CONSTRAINT "_MangaToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MangaToUser" ADD CONSTRAINT "_MangaToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GenreToManga" ADD CONSTRAINT "_GenreToManga_A_fkey" FOREIGN KEY ("A") REFERENCES "genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GenreToManga" ADD CONSTRAINT "_GenreToManga_B_fkey" FOREIGN KEY ("B") REFERENCES "manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;
