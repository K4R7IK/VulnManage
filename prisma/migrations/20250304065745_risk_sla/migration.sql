-- CreateEnum
CREATE TYPE "AssestType" AS ENUM ('Internet', 'Intranet', 'Endpoint');

-- CreateTable
CREATE TABLE "RiskSLA" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "sla" INTEGER NOT NULL,
    "type" "AssestType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskSLA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RiskSLA_companyId_idx" ON "RiskSLA"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskSLA_companyId_riskLevel_key" ON "RiskSLA"("companyId", "riskLevel");

-- AddForeignKey
ALTER TABLE "RiskSLA" ADD CONSTRAINT "RiskSLA_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
