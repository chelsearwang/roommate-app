/*
  Warnings:

  - You are about to drop the column `streakCount` on the `Household` table. All the data in the column will be lost.
  - You are about to drop the column `avatarLevel` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `xp` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Household" DROP COLUMN "streakCount",
ADD COLUMN     "plantType" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "avatarLevel",
DROP COLUMN "xp";
