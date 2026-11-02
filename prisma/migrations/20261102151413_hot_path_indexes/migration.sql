-- CreateIndex
CREATE INDEX "AccessGrant_agentId_resourceId_createdAt_idx" ON "AccessGrant"("agentId", "resourceId", "createdAt");

-- CreateIndex
CREATE INDEX "Quote_agentId_paidAt_idx" ON "Quote"("agentId", "paidAt");
