/*
  Warnings:

  - Added the required column `expiresAt` to the `subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `payingMonthlyAmount` to the `subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `payingYearlyAmount` to the `subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subscriptionModelId` to the `subscription` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "subscription" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoRenew" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoRenewAt" TIMESTAMP,
ADD COLUMN     "autoRenewCanceledReason" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP NOT NULL,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "payingMonthly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payingMonthlyAmount" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "payingYearly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payingYearlyAmount" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "paymentMethod" VARCHAR(256),
ADD COLUMN     "subscriptionModelId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "subscription_model" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "description" TEXT,
    "benefits" TEXT,
    "readAnticipationHours" INTEGER NOT NULL,
    "monthlyPrice" DOUBLE PRECISION NOT NULL,
    "yearlyPrice" DOUBLE PRECISION NOT NULL,
    "discountMonthlyPrice" DOUBLE PRECISION NOT NULL,
    "discountYearlyPrice" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_model_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_subscriptionModelId_fkey" FOREIGN KEY ("subscriptionModelId") REFERENCES "subscription_model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
