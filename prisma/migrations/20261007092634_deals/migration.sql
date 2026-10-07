-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('NEGOTIATING', 'NO_DEAL', 'INVOICED', 'PAID', 'FAILED');

-- AlterEnum
ALTER TYPE "LedgerKind" ADD VALUE 'LICENSE_SALE';

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "resourceIds" TEXT[],
    "listPriceCents" INTEGER NOT NULL,
    "budgetCents" INTEGER NOT NULL,
    "floorCents" INTEGER NOT NULL,
    "agreedPriceCents" INTEGER,
    "status" "DealStatus" NOT NULL DEFAULT 'NEGOTIATING',
    "transcript" JSONB NOT NULL DEFAULT '[]',
    "buyerEmail" TEXT,
    "paypalInvoiceId" TEXT,
    "invoiceUrl" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Deal_paypalInvoiceId_key" ON "Deal"("paypalInvoiceId");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
