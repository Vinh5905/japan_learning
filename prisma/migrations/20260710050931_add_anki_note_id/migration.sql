-- AlterTable
ALTER TABLE "vocabulary_items" ADD COLUMN     "anki_note_id" INTEGER;

-- CreateIndex
CREATE INDEX "vocabulary_items_anki_note_id_idx" ON "vocabulary_items"("anki_note_id");
