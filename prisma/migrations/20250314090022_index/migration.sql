-- CreateIndex
CREATE INDEX "Vulnerability_uniqueHash_companyId_idx" ON "Vulnerability"("uniqueHash", "companyId");
