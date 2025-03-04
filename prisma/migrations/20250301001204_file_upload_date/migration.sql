/*
  Warnings:

  - You are about to drop the column `quarterDate` on the `VulnerabilityQuarter` table. All the data in the column will be lost.
  - Added the required column `fileUploadDate` to the `Vulnerability` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileUploadDate` to the `VulnerabilityQuarter` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `VulnerabilityQuarter` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileUploadDate` to the `VulnerabilitySummary` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Vulnerability" ADD COLUMN     "fileUploadDate" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "VulnerabilityQuarter" DROP COLUMN "quarterDate",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fileUploadDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "quarter" SET DATA TYPE VARCHAR(8);

-- AlterTable
ALTER TABLE "VulnerabilitySummary" ADD COLUMN     "fileUploadDate" TIMESTAMP(3) NOT NULL;
