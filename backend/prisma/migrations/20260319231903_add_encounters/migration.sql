-- CreateTable
CREATE TABLE "encounters" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "round" INTEGER NOT NULL DEFAULT 1,
    "current_turn_index" INTEGER NOT NULL DEFAULT 0,
    "linked_decision_id" UUID,
    "outcome_type" TEXT,
    "outcome" TEXT,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounter_participants" (
    "id" UUID NOT NULL,
    "encounter_id" UUID NOT NULL,
    "character_id" UUID,
    "name" TEXT NOT NULL,
    "is_player" BOOLEAN NOT NULL DEFAULT false,
    "initiative" INTEGER NOT NULL DEFAULT 0,
    "hp_max" INTEGER,
    "hp_current" INTEGER,
    "armor_class" INTEGER,
    "conditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encounter_participants_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_linked_decision_id_fkey" FOREIGN KEY ("linked_decision_id") REFERENCES "decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_participants" ADD CONSTRAINT "encounter_participants_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_participants" ADD CONSTRAINT "encounter_participants_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
