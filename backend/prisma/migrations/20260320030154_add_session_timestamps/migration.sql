/*
  Warnings:

  - You are about to drop the column `duration_minutes` on the `sessions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "decision_links" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sessions" DROP COLUMN "duration_minutes",
ALTER COLUMN "started_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "ended_at" SET DATA TYPE TIMESTAMP(3);

-- RenameIndex
ALTER INDEX "decision_links_from_to_unique" RENAME TO "decision_links_from_decision_id_to_decision_id_key";
