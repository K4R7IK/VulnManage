-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('None', 'Low', 'Medium', 'High', 'Critical');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('Admin', 'Editor', 'User');

-- CreateTable
CREATE TABLE "Company" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vulnerability" (
    "id" TEXT NOT NULL,
    "assetIp" TEXT NOT NULL,
    "assetOS" TEXT,
    "port" INTEGER,
    "protocol" TEXT,
    "title" TEXT NOT NULL,
    "cveId" TEXT[],
    "description" TEXT NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "cvssScore" DOUBLE PRECISION,
    "impact" TEXT NOT NULL,
    "recommendations" TEXT NOT NULL,
    "references" TEXT[],
    "pluginOutput" TEXT,
    "quarters" TEXT[],
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "uniqueHash" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vulnerability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VulnerabilitySummary" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "quarter" TEXT NOT NULL,
    "osSummary" JSONB NOT NULL,
    "riskSummary" JSONB NOT NULL,
    "topDevices" JSONB NOT NULL,
    "resolvedCount" INTEGER NOT NULL,
    "unresolvedCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VulnerabilitySummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'User',
    "companyId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Vulnerability_uniqueHash_key" ON "Vulnerability"("uniqueHash");

-- CreateIndex
CREATE INDEX "Vulnerability_riskLevel_idx" ON "Vulnerability"("riskLevel");

-- CreateIndex
CREATE INDEX "Vulnerability_assetIp_idx" ON "Vulnerability"("assetIp");

-- CreateIndex
CREATE INDEX "Vulnerability_quarters_idx" ON "Vulnerability"("quarters");

-- CreateIndex
CREATE UNIQUE INDEX "Vulnerability_companyId_uniqueHash_key" ON "Vulnerability"("companyId", "uniqueHash");

-- CreateIndex
CREATE UNIQUE INDEX "VulnerabilitySummary_companyId_quarter_key" ON "VulnerabilitySummary"("companyId", "quarter");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Vulnerability" ADD CONSTRAINT "Vulnerability_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VulnerabilitySummary" ADD CONSTRAINT "VulnerabilitySummary_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
