-- CreateEnum
CREATE TYPE "TopUpStatus" AS ENUM ('CREATED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- AlterEnum
ALTER TYPE "LedgerKind" ADD VALUE 'PAYOUT_REVERSAL';

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "autoRechargeAmountCents" INTEGER,
ADD COLUMN     "autoRechargeThresholdCents" INTEGER,
ADD COLUMN     "paypalCustomerId" TEXT,
ADD COLUMN     "paypalVaultId" TEXT;

-- CreateTable
CREATE TABLE "TopUp" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paypalOrderId" TEXT,
    "captureId" TEXT,
    "status" "TopUpStatus" NOT NULL DEFAULT 'CREATED',
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "TopUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "receiverEmail" TEXT NOT NULL,
    "paypalBatchId" TEXT,
    "paypalStatus" TEXT,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TopUp_paypalOrderId_key" ON "TopUp"("paypalOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "TopUp_captureId_key" ON "TopUp"("captureId");

-- CreateIndex
CREATE INDEX "TopUp_agentId_createdAt_idx" ON "TopUp"("agentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_paypalBatchId_key" ON "Payout"("paypalBatchId");

-- AddForeignKey
ALTER TABLE "TopUp" ADD CONSTRAINT "TopUp_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
