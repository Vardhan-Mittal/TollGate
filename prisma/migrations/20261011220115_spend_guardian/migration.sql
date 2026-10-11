-- CreateEnum
CREATE TYPE "RiskDecision" AS ENUM ('ALLOW', 'FLAG', 'HOLD');

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "frozenAt" TIMESTAMP(3),
ADD COLUMN     "frozenReason" TEXT;

-- CreateTable
CREATE TABLE "RiskEvent" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "decision" "RiskDecision" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "signals" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "aiNote" TEXT,
    "resourceId" TEXT,
    "priceCents" INTEGER,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RiskEvent_agentId_createdAt_idx" ON "RiskEvent"("agentId", "createdAt");

-- AddForeignKey
ALTER TABLE "RiskEvent" ADD CONSTRAINT "RiskEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
