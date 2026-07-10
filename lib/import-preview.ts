import type {
  DuplicateKanjiPreview,
  DuplicateVocabularyPreview,
  ImportPreview,
  KanjiBlock,
  KanjiImportItem,
  TableData,
  VocabularyImportItem,
} from "@/lib/types";

export function buildImportPreview(
  imported: KanjiImportItem[],
  tableData: TableData,
): ImportPreview {
  const existingByKanji = new Map<string, KanjiBlock>();

  for (const group of tableData.groups) {
    for (const kanjiItem of group.kanjiItems) {
      existingByKanji.set(kanjiItem.kanji, kanjiItem);
    }
  }

  const newKanji: KanjiImportItem[] = [];
  const duplicateKanji: DuplicateKanjiPreview[] = [];
  let newVocabularyCount = 0;
  let duplicateVocabularyCount = 0;

  imported.forEach((incoming, importIndex) => {
    const existing = existingByKanji.get(incoming.kanji);

    if (!existing) {
      newKanji.push(incoming);
      newVocabularyCount += incoming.vocabulary.length;
      return;
    }

    const existingVocabularyByWord = new Map(
      existing.vocabulary.map((row) => [row.word, row]),
    );
    const newVocabulary: VocabularyImportItem[] = [];
    const duplicateVocabulary: DuplicateVocabularyPreview[] = [];

    incoming.vocabulary.forEach((vocabulary, importVocabularyIndex) => {
      const duplicate = existingVocabularyByWord.get(vocabulary.word);

      if (!duplicate) {
        newVocabulary.push(vocabulary);
        newVocabularyCount += 1;
        return;
      }

      duplicateVocabulary.push({
        id: buildVocabularyDuplicateId(
          incoming.kanji,
          importVocabularyIndex,
          vocabulary.word,
        ),
        kanji: incoming.kanji,
        importVocabularyIndex,
        word: vocabulary.word,
        existing: duplicate,
        incoming: vocabulary,
      });
      duplicateVocabularyCount += 1;
    });

    duplicateKanji.push({
      kanji: incoming.kanji,
      importIndex,
      existing,
      incoming,
      newVocabulary,
      duplicateVocabulary,
    });
  });

  return {
    imported,
    newKanji,
    duplicateKanji,
    summary: {
      newKanji: newKanji.length,
      duplicateKanji: duplicateKanji.length,
      newVocabulary: newVocabularyCount,
      duplicateVocabulary: duplicateVocabularyCount,
    },
  };
}

export function buildVocabularyDuplicateId(
  kanji: string,
  importVocabularyIndex: number,
  word: string,
) {
  return `${encodeURIComponent(kanji)}:${importVocabularyIndex}:${encodeURIComponent(word)}`;
}
