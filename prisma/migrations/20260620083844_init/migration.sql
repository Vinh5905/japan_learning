-- CreateEnum
CREATE TYPE "ReviewMode" AS ENUM ('reading', 'writing');

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "is_collapsed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kanji_items" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "kanji" TEXT NOT NULL,
    "han_viet" TEXT NOT NULL DEFAULT '',
    "meaning" TEXT NOT NULL DEFAULT '',
    "kun" JSONB NOT NULL DEFAULT '[]',
    "on" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kanji_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabulary_items" (
    "id" TEXT NOT NULL,
    "kanji_item_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "word" TEXT NOT NULL DEFAULT '',
    "reading" TEXT NOT NULL DEFAULT '',
    "meaning" TEXT NOT NULL DEFAULT '',
    "example_japanese" JSONB NOT NULL DEFAULT '[]',
    "example_vietnamese" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vocabulary_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_column_settings" (
    "id" TEXT NOT NULL,
    "column_key" TEXT NOT NULL,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_column_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_attempts" (
    "id" TEXT NOT NULL,
    "vocabulary_item_id" TEXT NOT NULL,
    "mode" "ReviewMode" NOT NULL,
    "answer" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "groups_order_idx" ON "groups"("order");

-- CreateIndex
CREATE UNIQUE INDEX "kanji_items_kanji_key" ON "kanji_items"("kanji");

-- CreateIndex
CREATE INDEX "kanji_items_group_id_order_idx" ON "kanji_items"("group_id", "order");

-- CreateIndex
CREATE INDEX "vocabulary_items_kanji_item_id_order_idx" ON "vocabulary_items"("kanji_item_id", "order");

-- CreateIndex
CREATE INDEX "vocabulary_items_kanji_item_id_word_idx" ON "vocabulary_items"("kanji_item_id", "word");

-- CreateIndex
CREATE UNIQUE INDEX "user_column_settings_column_key_key" ON "user_column_settings"("column_key");

-- CreateIndex
CREATE INDEX "review_attempts_vocabulary_item_id_created_at_idx" ON "review_attempts"("vocabulary_item_id", "created_at");

-- AddForeignKey
ALTER TABLE "kanji_items" ADD CONSTRAINT "kanji_items_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_items" ADD CONSTRAINT "vocabulary_items_kanji_item_id_fkey" FOREIGN KEY ("kanji_item_id") REFERENCES "kanji_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_attempts" ADD CONSTRAINT "review_attempts_vocabulary_item_id_fkey" FOREIGN KEY ("vocabulary_item_id") REFERENCES "vocabulary_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
