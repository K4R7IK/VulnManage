-- AlterTable
ALTER TABLE "VulnerabilitySummary" ADD COLUMN     "assetChangeRate" DOUBLE PRECISION,
ADD COLUMN     "uniqueAssetCount" INTEGER,
ADD COLUMN     "vulnerabilityGrowthRate" DOUBLE PRECISION;
