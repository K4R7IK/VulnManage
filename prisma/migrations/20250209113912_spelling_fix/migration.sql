/*
  Warnings:

  - You are about to drop the column `compnayId` on the `RegisterToken` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "RegisterToken" DROP COLUMN "compnayId",
ADD COLUMN     "companyId" INTEGER;
