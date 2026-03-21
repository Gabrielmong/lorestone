-- AlterTable
ALTER TABLE "mission_maps" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "wiki_pages" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "dice_sets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "colorset" TEXT NOT NULL DEFAULT '',
    "custom_bg" TEXT NOT NULL DEFAULT '#8b0000',
    "custom_fg" TEXT NOT NULL DEFAULT '#f5e6c8',
    "material" TEXT NOT NULL DEFAULT 'metal',
    "surface" TEXT NOT NULL DEFAULT 'green-felt',
    "texture" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dice_sets_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "dice_sets" ADD CONSTRAINT "dice_sets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
