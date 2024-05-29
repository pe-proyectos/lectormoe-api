/*
  Warnings:

  - You are about to drop the column `organizationId` on the `subscription` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `subscription` table. All the data in the column will be lost.
  - Added the required column `memberId` to the `subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `subscription_model` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "subscription" DROP CONSTRAINT "subscription_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "subscription" DROP CONSTRAINT "subscription_userId_fkey";

-- DropIndex
DROP INDEX "subscription_organizationId_userId_key";

-- AlterTable
ALTER TABLE "subscription" DROP COLUMN "organizationId",
DROP COLUMN "userId",
ADD COLUMN     "memberId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "subscription_model" ADD COLUMN     "organizationId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "subscription_model" ADD CONSTRAINT "subscription_model_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
