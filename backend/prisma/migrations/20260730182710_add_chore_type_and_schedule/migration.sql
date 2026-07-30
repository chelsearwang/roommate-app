-- AlterTable
ALTER TABLE "Chore" ADD COLUMN     "scheduleOccurrence" TEXT,
ADD COLUMN     "scheduleWeekday" INTEGER,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'recurring',
ALTER COLUMN "frequency" DROP NOT NULL;
