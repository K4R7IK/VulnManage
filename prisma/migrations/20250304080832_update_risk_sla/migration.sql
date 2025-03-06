/*
  Warnings:

  - A unique constraint covering the columns `[companyId,riskLevel,type]` on the table `RiskSLA` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `riskLevel` on the `RiskSLA` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `type` on the `RiskSLA` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropIndex
DROP INDEX "RiskSLA_companyId_riskLevel_key";

-- AlterTable
ALTER TABLE "RiskSLA" DROP COLUMN "riskLevel",
ADD COLUMN     "riskLevel" TEXT NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" TEXT NOT NULL;

-- DropEnum
DROP TYPE "AssestType";

-- CreateIndex
CREATE UNIQUE INDEX "RiskSLA_companyId_riskLevel_type_key" ON "RiskSLA"("companyId", "riskLevel", "type");
