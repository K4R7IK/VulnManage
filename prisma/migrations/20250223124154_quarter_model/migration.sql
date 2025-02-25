/*
  Warnings:

  - You are about to alter the column `name` on the `Company` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `token` on the `RegisterToken` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `email` on the `RegisterToken` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `name` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `email` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `password` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - The primary key for the `Vulnerability` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `isResolved` on the `Vulnerability` table. All the data in the column will be lost.
  - You are about to drop the column `quarters` on the `Vulnerability` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `Vulnerability` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(26)`.
  - You are about to alter the column `assetIp` on the `Vulnerability` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(45)`.
  - You are about to alter the column `assetOS` on the `Vulnerability` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `protocol` on the `Vulnerability` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(10)`.
  - You are about to alter the column `title` on the `Vulnerability` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(400)`.
  - You are about to alter the column `cveId` on the `Vulnerability` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `references` on the `Vulnerability` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `uniqueHash` on the `Vulnerability` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(64)`.
  - The primary key for the `VulnerabilitySummary` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `VulnerabilitySummary` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(26)`.
  - Added the required column `expiresAt` to the `RegisterToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalCount` to the `VulnerabilitySummary` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `quarter` on the `VulnerabilitySummary` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropIndex
DROP INDEX "Vulnerability_assetIp_idx";

-- DropIndex
DROP INDEX "Vulnerability_quarters_idx";

-- DropIndex
DROP INDEX "Vulnerability_riskLevel_idx";

-- AlterTable
ALTER TABLE "Company" ALTER COLUMN "name" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "RegisterToken" ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "token" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "email" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLogin" TIMESTAMP(3),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "email" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "password" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "Vulnerability" DROP CONSTRAINT "Vulnerability_pkey",
DROP COLUMN "isResolved",
DROP COLUMN "quarters",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(26),
ALTER COLUMN "assetIp" SET DATA TYPE VARCHAR(45),
ALTER COLUMN "assetOS" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "protocol" SET DATA TYPE VARCHAR(10),
ALTER COLUMN "title" SET DATA TYPE VARCHAR(400),
ALTER COLUMN "cveId" SET DATA TYPE VARCHAR(20)[],
ALTER COLUMN "references" SET DATA TYPE VARCHAR(255)[],
ALTER COLUMN "uniqueHash" SET DATA TYPE VARCHAR(64),
ADD CONSTRAINT "Vulnerability_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "VulnerabilitySummary" DROP CONSTRAINT "VulnerabilitySummary_pkey",
ADD COLUMN     "totalCount" INTEGER NOT NULL,
ALTER COLUMN "id" SET DATA TYPE VARCHAR(26),
DROP COLUMN "quarter",
ADD COLUMN     "quarter" TIMESTAMP(3) NOT NULL,
ADD CONSTRAINT "VulnerabilitySummary_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "VulnerabilityQuarter" (
    "id" VARCHAR(26) NOT NULL,
    "vulnerabilityId" VARCHAR(26) NOT NULL,
    "quarter" VARCHAR(7) NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "quarterDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VulnerabilityQuarter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VulnerabilityQuarter_quarter_isResolved_idx" ON "VulnerabilityQuarter"("quarter", "isResolved");

-- CreateIndex
CREATE INDEX "VulnerabilityQuarter_vulnerabilityId_isResolved_idx" ON "VulnerabilityQuarter"("vulnerabilityId", "isResolved");

-- CreateIndex
CREATE UNIQUE INDEX "VulnerabilityQuarter_vulnerabilityId_quarter_key" ON "VulnerabilityQuarter"("vulnerabilityId", "quarter");

-- CreateIndex
CREATE INDEX "Company_name_idx" ON "Company"("name");

-- CreateIndex
CREATE INDEX "RegisterToken_token_idx" ON "RegisterToken"("token");

-- CreateIndex
CREATE INDEX "RegisterToken_expiresAt_idx" ON "RegisterToken"("expiresAt");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_companyId_role_idx" ON "User"("companyId", "role");

-- CreateIndex
CREATE INDEX "Vulnerability_riskLevel_companyId_idx" ON "Vulnerability"("riskLevel", "companyId");

-- CreateIndex
CREATE INDEX "Vulnerability_assetIp_companyId_idx" ON "Vulnerability"("assetIp", "companyId");

-- CreateIndex
CREATE INDEX "VulnerabilitySummary_quarter_idx" ON "VulnerabilitySummary"("quarter");

-- CreateIndex
CREATE UNIQUE INDEX "VulnerabilitySummary_companyId_quarter_key" ON "VulnerabilitySummary"("companyId", "quarter");

-- AddForeignKey
ALTER TABLE "VulnerabilityQuarter" ADD CONSTRAINT "VulnerabilityQuarter_vulnerabilityId_fkey" FOREIGN KEY ("vulnerabilityId") REFERENCES "Vulnerability"("id") ON DELETE CASCADE ON UPDATE CASCADE;
