export type ExampleToken = {
  text: string;
  reading?: string;
  is_target?: boolean;
};

export const VOCABULARY_TYPES = [
  "danh từ",
  "tính từ i",
  "tính từ na",
  "tha động từ",
  "tự động từ",
] as const;

export type VocabularyType = (typeof VOCABULARY_TYPES)[number];

export type VocabularyImportItem = {
  word: string;
  han_viet: string;
  type: VocabularyType;
  reading: string;
  meaning: string;
  example: {
    japanese: ExampleToken[];
    vietnamese: string;
  };
};

export type KanjiImportItem = {
  kanji: string;
  han_viet: string;
  meaning: string;
  kun: string[];
  on: string[];
  vocabulary: VocabularyImportItem[];
};

export type VocabularyRow = {
  id: string;
  sortOrder: number;
  word: string;
  hanViet: string;
  type: VocabularyType;
  reading: string;
  meaning: string;
  exampleJapanese: ExampleToken[];
  exampleVietnamese: string;
};

export type KanjiBlock = {
  id: string;
  groupId: string;
  sortOrder: number;
  kanji: string;
  hanViet: string;
  meaning: string;
  kun: string[];
  on: string[];
  vocabulary: VocabularyRow[];
};

export type KanjiGroup = {
  id: string;
  sortOrder: number;
  isCollapsed: boolean;
  kanjiItems: KanjiBlock[];
};

export type TableData = {
  groups: KanjiGroup[];
  columnSettings: Record<ColumnKey, boolean>;
};

export type ColumnKey =
  | "collapse"
  | "group"
  | "kanjiDetails"
  | "word"
  | "wordHanViet"
  | "type"
  | "reading"
  | "meaning"
  | "example"
  | "answer"
  | "reveal";

export type StudyMode = "study" | "reading" | "writing";

export type MoveTargetType = "group" | "kanji" | "vocabulary";

export type MoveDirection = "up" | "down";

export type EditableItemType = "kanji" | "vocabulary";

export type KanjiDuplicateDecision = "keep_old" | "use_new" | "merge";

export type VocabularyDuplicateDecision = "keep_old" | "use_new" | "keep_both";

export type ValidationErrorItem = {
  path: string;
  message: string;
};

export type DuplicateVocabularyPreview = {
  id: string;
  kanji: string;
  importVocabularyIndex: number;
  word: string;
  existing: VocabularyRow;
  incoming: VocabularyImportItem;
};

export type DuplicateKanjiPreview = {
  kanji: string;
  importIndex: number;
  existing: KanjiBlock;
  incoming: KanjiImportItem;
  newVocabulary: VocabularyImportItem[];
  duplicateVocabulary: DuplicateVocabularyPreview[];
};

export type ImportPreview = {
  imported: KanjiImportItem[];
  newKanji: KanjiImportItem[];
  duplicateKanji: DuplicateKanjiPreview[];
  summary: {
    newKanji: number;
    duplicateKanji: number;
    newVocabulary: number;
    duplicateVocabulary: number;
  };
};

export type ImportCommitRequest = {
  raw: string;
  kanjiDecisions?: Record<string, KanjiDuplicateDecision>;
  vocabularyDecisions?: Record<string, VocabularyDuplicateDecision>;
};
