CREATE TABLE "vocab_groups" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "is_collapsed" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "vocab_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "standalone_vocabulary_items" (
  "id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "word" TEXT NOT NULL DEFAULT '',
  "han_viet" TEXT NOT NULL DEFAULT '',
  "type" TEXT NOT NULL DEFAULT 'danh từ',
  "reading" TEXT NOT NULL DEFAULT '',
  "meaning" TEXT NOT NULL DEFAULT '',
  "examples" JSONB NOT NULL DEFAULT '[]',
  "anki_note_id" BIGINT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "standalone_vocabulary_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "standalone_vocabulary_attempts" (
  "id" TEXT NOT NULL,
  "vocabulary_item_id" TEXT NOT NULL,
  "mode" "ReviewMode" NOT NULL,
  "answer" TEXT NOT NULL,
  "is_correct" BOOLEAN NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "standalone_vocabulary_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vocab_groups_order_idx" ON "vocab_groups"("order");
CREATE INDEX "standalone_vocabulary_items_group_id_order_idx" ON "standalone_vocabulary_items"("group_id", "order");
CREATE INDEX "standalone_vocabulary_items_group_id_word_idx" ON "standalone_vocabulary_items"("group_id", "word");
CREATE INDEX "standalone_vocabulary_items_anki_note_id_idx" ON "standalone_vocabulary_items"("anki_note_id");
CREATE INDEX "standalone_vocabulary_attempts_vocabulary_item_id_created_at_idx" ON "standalone_vocabulary_attempts"("vocabulary_item_id", "created_at");

ALTER TABLE "standalone_vocabulary_items"
  ADD CONSTRAINT "standalone_vocabulary_items_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "vocab_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "standalone_vocabulary_attempts"
  ADD CONSTRAINT "standalone_vocabulary_attempts_vocabulary_item_id_fkey"
  FOREIGN KEY ("vocabulary_item_id") REFERENCES "standalone_vocabulary_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
