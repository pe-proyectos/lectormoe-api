-- CreateEnum
CREATE TYPE "JointRole" AS ENUM ('LEADER', 'UPLOADER', 'VIEWER');

-- CreateEnum
CREATE TYPE "JointMemberStatus" AS ENUM ('INVITED', 'ACCEPTED', 'REJECTED', 'EXPELLED');

-- AlterTable: make mangaCustomId nullable on chapter, add jointId and uploadedByOrganizationId
ALTER TABLE "chapter" ALTER COLUMN "mangaCustomId" DROP NOT NULL;
ALTER TABLE "chapter" ADD COLUMN "jointId" INTEGER;
ALTER TABLE "chapter" ADD COLUMN "uploadedByOrganizationId" INTEGER;

-- CreateTable: manga_joint
CREATE TABLE "manga_joint" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(256) NOT NULL,
    "mangaId" INTEGER NOT NULL,
    "title" VARCHAR(512) NOT NULL DEFAULT '',
    "shortDescription" VARCHAR(300),
    "description" TEXT,
    "imageUrl" TEXT,
    "bannerUrl" TEXT,
    "status" VARCHAR(64) NOT NULL DEFAULT 'ongoing',
    "workType" VARCHAR(64) NOT NULL DEFAULT 'manga',
    "lastChapterAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "manga_joint_pkey" PRIMARY KEY ("id")
);

-- CreateTable: joint_member
CREATE TABLE "joint_member" (
    "id" SERIAL NOT NULL,
    "jointId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "role" "JointRole" NOT NULL DEFAULT 'VIEWER',
    "status" "JointMemberStatus" NOT NULL DEFAULT 'INVITED',
    "canEditJoint" BOOLEAN NOT NULL DEFAULT false,
    "canInvite" BOOLEAN NOT NULL DEFAULT false,
    "canExpel" BOOLEAN NOT NULL DEFAULT false,
    "invitedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(6),

    CONSTRAINT "joint_member_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: manga_joint
CREATE UNIQUE INDEX "manga_joint_slug_key" ON "manga_joint"("slug");
CREATE INDEX "manga_joint_mangaId_idx" ON "manga_joint"("mangaId");
CREATE INDEX "manga_joint_lastChapterAt_idx" ON "manga_joint"("lastChapterAt");

-- CreateIndex: joint_member
CREATE UNIQUE INDEX "joint_member_jointId_organizationId_key" ON "joint_member"("jointId", "organizationId");

-- CreateIndex: chapter unique on jointId
CREATE UNIQUE INDEX "chapter_number_jointId_key" ON "chapter"("number", "jointId");

-- AddForeignKey: manga_joint -> manga
ALTER TABLE "manga_joint" ADD CONSTRAINT "manga_joint_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "manga"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: joint_member -> manga_joint
ALTER TABLE "joint_member" ADD CONSTRAINT "joint_member_jointId_fkey" FOREIGN KEY ("jointId") REFERENCES "manga_joint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: joint_member -> organization
ALTER TABLE "joint_member" ADD CONSTRAINT "joint_member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: chapter -> manga_joint
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_jointId_fkey" FOREIGN KEY ("jointId") REFERENCES "manga_joint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: chapter -> organization (uploader)
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_uploadedByOrganizationId_fkey" FOREIGN KEY ("uploadedByOrganizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Many-to-many: chapter <-> organization (worked by) — implicit Prisma relation table
CREATE TABLE "_ChapterWorkedBy" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);
CREATE UNIQUE INDEX "_ChapterWorkedBy_AB_unique" ON "_ChapterWorkedBy"("A", "B");
CREATE INDEX "_ChapterWorkedBy_B_index" ON "_ChapterWorkedBy"("B");
ALTER TABLE "_ChapterWorkedBy" ADD CONSTRAINT "_ChapterWorkedBy_A_fkey" FOREIGN KEY ("A") REFERENCES "chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ChapterWorkedBy" ADD CONSTRAINT "_ChapterWorkedBy_B_fkey" FOREIGN KEY ("B") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
