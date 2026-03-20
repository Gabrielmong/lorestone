-- Create decision_links junction table
CREATE TABLE "decision_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "from_decision_id" UUID NOT NULL,
    "from_branch_id" UUID,
    "to_decision_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "decision_links_pkey" PRIMARY KEY ("id")
);

-- Migrate existing single-parent chain data
INSERT INTO "decision_links" ("id", "from_decision_id", "from_branch_id", "to_decision_id", "created_at")
SELECT gen_random_uuid(), "requires_decision_id", "requires_branch_id", "id", now()
FROM "decisions"
WHERE "requires_decision_id" IS NOT NULL;

-- Foreign key constraints
ALTER TABLE "decision_links" ADD CONSTRAINT "decision_links_from_decision_id_fkey"
    FOREIGN KEY ("from_decision_id") REFERENCES "decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "decision_links" ADD CONSTRAINT "decision_links_from_branch_id_fkey"
    FOREIGN KEY ("from_branch_id") REFERENCES "decision_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "decision_links" ADD CONSTRAINT "decision_links_to_decision_id_fkey"
    FOREIGN KEY ("to_decision_id") REFERENCES "decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unique constraint: each pair can only link once
CREATE UNIQUE INDEX "decision_links_from_to_unique"
    ON "decision_links"("from_decision_id", "to_decision_id");

-- Drop old single-parent columns from decisions
ALTER TABLE "decisions" DROP COLUMN IF EXISTS "requires_decision_id";
ALTER TABLE "decisions" DROP COLUMN IF EXISTS "requires_branch_id";
