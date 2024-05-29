-- AlterTable
ALTER TABLE "member" ADD COLUMN     "canCreateSubscription" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canCreateSubscriptionModel" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canDeleteSubscription" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canDeleteSubscriptionModel" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canEditSubscription" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canEditSubscriptionModel" BOOLEAN NOT NULL DEFAULT false;
