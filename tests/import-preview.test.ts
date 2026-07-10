import { describe, expect, it } from "vitest";
import { buildImportPreview } from "@/lib/import-preview";
import type { KanjiImportItem, TableData } from "@/lib/types";

const existingData: TableData = {
  columnSettings: {
    collapse: true,
    group: true,
    kanjiDetails: true,
    word: true,
    wordHanViet: true,
    type: true,
    reading: true,
    meaning: true,
    example: true,
    answer: true,
    reveal: true,
  },
  groups: [
    {
      id: "group-1",
      sortOrder: 0,
      isCollapsed: false,
      kanjiItems: [
        {
          id: "kanji-1",
          groupId: "group-1",
          sortOrder: 0,
          kanji: "井",
          hanViet: "TỈNH",
          meaning: "old meaning",
          kun: ["い"],
          on: ["ショウ"],
          vocabulary: [
            {
              id: "vocab-1",
              sortOrder: 0,
              word: "井戸",
              hanViet: "TỈNH HỘ",
              type: "danh từ",
              reading: "いど",
              meaning: "old vocab",
              exampleJapanese: [{ text: "井戸", reading: "いど", is_target: true }],
              exampleVietnamese: "old example",
            },
          ],
        },
      ],
    },
  ],
};

describe("buildImportPreview", () => {
  it("separates new kanji, duplicate kanji, new vocabulary, and duplicate vocabulary", () => {
    const imported: KanjiImportItem[] = [
      {
        kanji: "井",
        han_viet: "TỈNH",
        meaning: "new meaning",
        kun: ["い"],
        on: ["セイ"],
        vocabulary: [
          {
            word: "井戸",
            han_viet: "TỈNH HỘ",
            type: "danh từ",
            reading: "せいど",
            meaning: "duplicate word with different reading",
            example: {
              japanese: [{ text: "井戸", reading: "せいど", is_target: true }],
              vietnamese: "duplicate",
            },
          },
          {
            word: "天井",
            han_viet: "THIÊN TỈNH",
            type: "danh từ",
            reading: "てんじょう",
            meaning: "ceiling",
            example: {
              japanese: [{ text: "天井", reading: "てんじょう", is_target: true }],
              vietnamese: "trần nhà",
            },
          },
        ],
      },
      {
        kanji: "日",
        han_viet: "NHẬT",
        meaning: "ngày",
        kun: ["ひ"],
        on: ["ニチ"],
        vocabulary: [],
      },
    ];

    const preview = buildImportPreview(imported, existingData);

    expect(preview.summary).toEqual({
      newKanji: 1,
      duplicateKanji: 1,
      newVocabulary: 1,
      duplicateVocabulary: 1,
    });
    expect(preview.newKanji[0].kanji).toBe("日");
    expect(preview.duplicateKanji[0].duplicateVocabulary[0].word).toBe("井戸");
    expect(preview.duplicateKanji[0].newVocabulary[0].word).toBe("天井");
  });
});
