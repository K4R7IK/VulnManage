/*
  Warnings:

  - Added the required column `newCount` to the `VulnerabilitySummary` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "VulnerabilitySummary" ADD COLUMN     "newCount" INTEGER NOT NULL;
