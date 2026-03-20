-- AlterTable
ALTER TABLE "encounters" ADD COLUMN     "outcome_decision_id" UUID;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_outcome_decision_id_fkey" FOREIGN KEY ("outcome_decision_id") REFERENCES "decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
