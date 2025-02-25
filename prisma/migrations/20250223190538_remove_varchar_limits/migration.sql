/*
  Warnings:

  - You are about to alter the column `name` on the `Company` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(50)`.

*/
-- AlterTable
ALTER TABLE "Company" ALTER COLUMN "name" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "Vulnerability" ALTER COLUMN "assetIp" SET DATA TYPE TEXT,
ALTER COLUMN "assetOS" SET DATA TYPE TEXT,
ALTER COLUMN "protocol" SET DATA TYPE TEXT,
ALTER COLUMN "title" SET DATA TYPE TEXT,
ALTER COLUMN "cveId" SET DATA TYPE TEXT[],
ALTER COLUMN "references" SET DATA TYPE TEXT[],
ALTER COLUMN "uniqueHash" SET DATA TYPE TEXT;

-- CreateIndex
CREATE INDEX "Vulnerability_title_companyId_idx" ON "Vulnerability"("title", "companyId");
