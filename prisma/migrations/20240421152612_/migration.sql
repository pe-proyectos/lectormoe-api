/*
  Warnings:

  - You are about to drop the column `language` on the `analytics` table. All the data in the column will be lost.
  - You are about to drop the column `trafficSource` on the `analytics` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "analytics" DROP COLUMN "language",
DROP COLUMN "trafficSource",
ADD COLUMN     "capturedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "event" TEXT,
ADD COLUMN     "screenHeight" INTEGER,
ADD COLUMN     "screenWidth" INTEGER,
ADD COLUMN     "userAgent" TEXT,
ALTER COLUMN "path" DROP NOT NULL,
ALTER COLUMN "ip" DROP NOT NULL;
