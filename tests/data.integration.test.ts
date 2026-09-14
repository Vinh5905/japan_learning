import { beforeEach, describe, expect, it } from "vitest";
import {
  commitImport,
  deleteItem,
  getTableData,
  moveStep,
  updateItem,
} from "@/lib/data";
import {
  commitStandaloneVocabularyImport,
  getStandaloneVocabularyData,
  moveStandaloneVocabularyStep,
  renameVocabGroup,
} from "@/lib/vocab-data";
import { buildVocabularyDuplicateId } from "@/lib/import-preview";
import { prisma } from "@/lib/prisma";
import type { KanjiImportItem } from "@/lib/types";

const destructiveDescribe =
  process.env.ALLOW_DATABASE_RESET === "true"
    ? describe.sequential
    : describe.sequential.skip;

destructiveDescribe("database import flow", () => {
  beforeEach(async () => {
    await prisma.standaloneVocabularyAttempt.deleteMany();
    await prisma.standaloneVocabularyItem.deleteMany();
    await prisma.vocabGroup.deleteMany();
    await prisma.reviewAttempt.deleteMany();
    await prisma.vocabularyItem.deleteMany();
    await prisma.kanjiItem.deleteMany();
    await prisma.group.deleteMany();
    await prisma.userColumnSetting.deleteMany();
  });

  it("creates one group for each new kanji", async () => {
    const result = await commitImport({
      raw: JSON.stringify([
        sampleKanji("井", "TỈNH", "cái giếng"),
        sampleKanji("日", "NHẬT", "ngày"),
      ]),
    });

    expect(result.ok).toBe(true);

    const data = await getTableData();
    expect(data.groups).toHaveLength(2);
    expect(data.groups.map((group) => group.kanjiItems[0].kanji)).toEqual([
      "井",
      "日",
    ]);
  });

  it("merges duplicate kanji and keeps both duplicate vocabulary rows by explicit decision", async () => {
    await commitImport({
      raw: JSON.stringify([
        {
          ...sampleKanji("井", "TỈNH", "old meaning"),
          kun: ["い"],
          on: ["ショウ"],
        },
      ]),
    });

    const duplicate: KanjiImportItem = {
      kanji: "井",
      han_viet: "TINH",
      meaning: "new meaning",
      kun: ["い", "ゐ"],
      on: ["セイ"],
      vocabulary: [
        {
          word: "井戸",
          han_viet: "TỈNH HỘ",
          type: "danh từ",
          reading: "せいど",
          meaning: "duplicate reading",
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
          meaning: "trần nhà",
          example: {
            japanese: [{ text: "天井", reading: "てんじょう", is_target: true }],
            vietnamese: "trần nhà",
          },
        },
      ],
    };

    const result = await commitImport({
      raw: JSON.stringify([duplicate]),
      kanjiDecisions: { "井": "merge" },
      vocabularyDecisions: {
        [buildVocabularyDuplicateId("井", 0, "井戸")]: "keep_both",
      },
    });

    expect(result.ok).toBe(true);

    const data = await getTableData();
    const kanji = data.groups[0].kanjiItems[0];

    expect(kanji.hanViet).toBe("TỈNH");
    expect(kanji.meaning).toBe("old meaning");
    expect(kanji.kun).toEqual(["い", "ゐ"]);
    expect(kanji.on).toEqual(["ショウ", "セイ"]);
    expect(kanji.vocabulary.map((row) => row.word)).toEqual([
      "井戸",
      "井戸",
      "天井",
    ]);
  });

  it("moves a kanji into a new group at the bottom and deletes empty groups later", async () => {
    const groupOne = await prisma.group.create({ data: { sortOrder: 0 } });
    const groupTwo = await prisma.group.create({ data: { sortOrder: 1 } });

    await prisma.kanjiItem.create({
      data: {
        groupId: groupOne.id,
        sortOrder: 0,
        kanji: "井",
        hanViet: "TỈNH",
        meaning: "cái giếng",
      },
    });
    await prisma.kanjiItem.create({
      data: {
        groupId: groupTwo.id,
        sortOrder: 0,
        kanji: "日",
        hanViet: "NHẬT",
        meaning: "ngày",
      },
    });
    const moon = await prisma.kanjiItem.create({
      data: {
        groupId: groupTwo.id,
        sortOrder: 1,
        kanji: "月",
        hanViet: "NGUYỆT",
        meaning: "tháng",
      },
    });

    const afterDown = await moveStep({
      type: "kanji",
      id: moon.id,
      direction: "down",
    });

    expect(afterDown.groups.map((group) => group.kanjiItems.map((item) => item.kanji))).toEqual([
      ["井"],
      ["日"],
      ["月"],
    ]);

    const afterUp = await moveStep({
      type: "kanji",
      id: moon.id,
      direction: "up",
    });

    expect(afterUp.groups.map((group) => group.kanjiItems.map((item) => item.kanji))).toEqual([
      ["井"],
      ["日", "月"],
    ]);
  });

  it("updates editable fields and deletes only kanji or vocabulary items", async () => {
    const importResult = await commitImport({
      raw: JSON.stringify([sampleKanji("井", "TỈNH", "old meaning")]),
    });

    expect(importResult.ok).toBe(true);

    const initial = await getTableData();
    const kanji = initial.groups[0].kanjiItems[0];
    const vocabulary = kanji.vocabulary[0];

    await updateItem({
      type: "vocabulary",
      id: vocabulary.id,
      data: {
        word: "井戸",
        hanViet: "TỈNH HỘ",
        type: "tính từ na",
        reading: "いど",
        meaning: "updated meaning",
      },
    });
    await updateItem({
      type: "kanji",
      id: kanji.id,
      data: {
        kanji: "井",
        hanViet: "TỈNH",
        meaning: "updated kanji",
        kun: ["い"],
        on: ["ショウ"],
      },
    });

    const afterUpdate = await getTableData();
    expect(afterUpdate.groups[0].kanjiItems[0].meaning).toBe("updated kanji");
    expect(afterUpdate.groups[0].kanjiItems[0].vocabulary[0].meaning).toBe(
      "updated meaning",
    );
    expect(afterUpdate.groups[0].kanjiItems[0].vocabulary[0].type).toBe(
      "tính từ na",
    );
    expect(afterUpdate.groups[0].kanjiItems[0].vocabulary[0].hanViet).toBe(
      "TỈNH HỘ",
    );

    await deleteItem({
      type: "vocabulary",
      id: vocabulary.id,
    });

    const afterVocabularyDelete = await getTableData();
    expect(afterVocabularyDelete.groups[0].kanjiItems[0].vocabulary).toHaveLength(0);

    await deleteItem({
      type: "kanji",
      id: kanji.id,
    });

    const afterKanjiDelete = await getTableData();
    expect(afterKanjiDelete.groups).toHaveLength(0);
  });

  it("creates one standalone vocabulary group, renames it, and moves words across groups", async () => {
    const first = await commitStandaloneVocabularyImport(
      JSON.stringify({
        vocabulary: [sampleStandaloneVocabulary("領土", "LĨNH THỔ", "りょうど")],
      }),
    );
    const second = await commitStandaloneVocabularyImport(
      JSON.stringify({
        group_name: "Lesson 2",
        vocabulary: [
          sampleStandaloneVocabulary("冷やす", "LÃNH", "ひやす"),
          sampleStandaloneVocabulary("冷える", "LÃNH", "ひえる"),
        ],
      }),
    );

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);

    let data = await getStandaloneVocabularyData();
    expect(data.groups.map((group) => group.name)).toEqual([
      "New group",
      "Lesson 2",
    ]);

    const renameResult = await renameVocabGroup(data.groups[0].id, "Lesson 1");
    expect(renameResult.ok).toBe(true);

    data = await getStandaloneVocabularyData();
    const firstWordInSecondGroup = data.groups[1].vocabulary[0];

    await moveStandaloneVocabularyStep(firstWordInSecondGroup.id, "up");

    data = await getStandaloneVocabularyData();
    expect(data.groups.map((group) => group.name)).toEqual([
      "Lesson 1",
      "Lesson 2",
    ]);
    expect(data.groups[0].vocabulary.map((row) => row.word)).toEqual([
      "領土",
      "冷やす",
    ]);
    expect(data.groups[1].vocabulary.map((row) => row.word)).toEqual(["冷える"]);
  });
});

function sampleKanji(
  kanji: string,
  hanViet: string,
  meaning: string,
): KanjiImportItem {
  return {
    kanji,
    han_viet: hanViet,
    meaning,
    kun: [],
    on: [],
    vocabulary: [
      {
        word: `${kanji}戸`,
        han_viet: `${hanViet} HỘ`,
        type: "danh từ",
        reading: "いど",
        meaning: "giếng nước",
        example: {
          japanese: [{ text: `${kanji}戸`, reading: "いど", is_target: true }],
          vietnamese: "giếng nước",
        },
      },
    ],
  };
}

function sampleStandaloneVocabulary(word: string, hanViet: string, reading: string) {
  return {
    word,
    han_viet: hanViet,
    type: "danh từ",
    reading,
    meaning: "sample meaning",
    examples: [
      {
        japanese: [{ text: word, reading, is_target: true }],
        vietnamese: "sample",
      },
    ],
  };
}
