-- AlterTable
ALTER TABLE "Resource" ADD COLUMN     "aiPriceReadCents" INTEGER,
ADD COLUMN     "aiPriceTrainCents" INTEGER,
ADD COLUMN     "priceOverridden" BOOLEAN NOT NULL DEFAULT false;
