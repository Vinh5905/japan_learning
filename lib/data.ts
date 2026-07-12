import { DEFAULT_COLUMN_SETTINGS } from "@/lib/constants";
import { buildVocabularyDuplicateId } from "@/lib/import-preview";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { mergeUniqueStrings } from "@/lib/study";
import { VOCABULARY_TYPES } from "@/lib/types";
import {
  AnkiConnectError,
  ankiDeleteNotes,
  ankiUpdateNoteFields,
  buildAnkiFields,
} from "@/lib/anki";
import type {
  ColumnKey,
  EditableItemType,
  ExampleToken,
  ImportCommitRequest,
  KanjiBlock,
  KanjiImportItem,
  MoveDirection,
  MoveTargetType,
  TableData,
  VocabularyImportItem,
  VocabularyRow,
  VocabularyType,
} from "@/lib/types";

export async function getTableData(): Promise<TableData> {
  const [groups, settings] = await Promise.all([
    prisma.group.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        kanjiItems: {
          orderBy: { sortOrder: "asc" },
          include: {
            vocabulary: {
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    }),
    prisma.userColumnSetting.findMany(),
  ]);

  const columnSettings = { ...DEFAULT_COLUMN_SETTINGS };
  for (const setting of settings) {
    if (setting.columnKey in columnSettings) {
      columnSettings[setting.columnKey as ColumnKey] = setting.isVisible;
    }
  }

  return {
    groups: groups.map((group) => ({
      id: group.id,
      sortOrder: group.sortOrder,
      isCollapsed: group.isCollapsed,
      kanjiItems: group.kanjiItems.map((item) => serializeKanjiItem(item)),
    })),
    columnSettings,
  };
}

export async function commitImport(request: ImportCommitRequest) {
  const { parseImportJson } = await import("@/lib/import-validation");
  const parsed = parseImportJson(request.raw);

  if (!parsed.ok) {
    return {
      ok: false as const,
      errors: parsed.errors,
    };
  }

  await prisma.$transaction(async (tx) => {
    let nextGroupOrder = await getNextGroupOrder(tx);

    for (const incoming of parsed.items) {
      const existing = await tx.kanjiItem.findUnique({
        where: { kanji: incoming.kanji },
        include: {
          vocabulary: {
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      if (!existing) {
        await createNewKanjiGroup(tx, incoming, nextGroupOrder);
        nextGroupOrder += 1;
        continue;
      }

      const kanjiDecision =
        request.kanjiDecisions?.[incoming.kanji] ?? "keep_old";

      if (kanjiDecision !== "keep_old") {
        await tx.kanjiItem.update({
          where: { id: existing.id },
          data:
            kanjiDecision === "use_new"
              ? {
                  hanViet: incoming.han_viet,
                  meaning: incoming.meaning,
                  kun: incoming.kun,
                  on: incoming.on,
                }
              : {
                  hanViet: existing.hanViet || incoming.han_viet,
                  meaning: existing.meaning || incoming.meaning,
                  kun: mergeUniqueStrings(asStringArray(existing.kun), incoming.kun),
                  on: mergeUniqueStrings(asStringArray(existing.on), incoming.on),
                },
        });
      }

      const existingVocabularyByWord = new Map(
        existing.vocabulary.map((row) => [row.word, row]),
      );
      let nextVocabularyOrder =
        existing.vocabulary.reduce(
          (max, row) => Math.max(max, row.sortOrder),
          -1,
        ) + 1;

      for (const [index, vocabulary] of incoming.vocabulary.entries()) {
        const duplicate = existingVocabularyByWord.get(vocabulary.word);

        if (!duplicate) {
          await createVocabulary(tx, existing.id, vocabulary, nextVocabularyOrder);
          nextVocabularyOrder += 1;
          continue;
        }

        const duplicateId = buildVocabularyDuplicateId(
          incoming.kanji,
          index,
          vocabulary.word,
        );
        const decision =
          request.vocabularyDecisions?.[duplicateId] ?? "keep_old";

        if (decision === "use_new") {
          await tx.vocabularyItem.update({
            where: { id: duplicate.id },
            data: vocabularyData(vocabulary),
          });
        }

        if (decision === "keep_both") {
          await createVocabulary(tx, existing.id, vocabulary, nextVocabularyOrder);
          nextVocabularyOrder += 1;
        }
      }
    }
  });

  return {
    ok: true as const,
    data: await getTableData(),
  };
}

export async function saveColumnSettings(settings: Record<ColumnKey, boolean>) {
  await prisma.$transaction(
    Object.entries(settings).map(([columnKey, isVisible]) =>
      prisma.userColumnSetting.upsert({
        where: { columnKey },
        update: { isVisible },
        create: { columnKey, isVisible },
      }),
    ),
  );
}

export async function setAllGroupsCollapsed(isCollapsed: boolean) {
  await prisma.group.updateMany({
    data: { isCollapsed },
  });

  return getTableData();
}

export async function moveStep(request: {
  type: MoveTargetType;
  id: string;
  direction: MoveDirection;
}) {
  if (request.type === "group") {
    await moveGroupStep(request.id, request.direction);
  }

  if (request.type === "kanji") {
    await moveKanjiStep(request.id, request.direction);
  }

  if (request.type === "vocabulary") {
    await moveVocabularyStep(request.id, request.direction);
  }

  return getTableData();
}

export async function updateItem(request: {
  type: EditableItemType;
  id: string;
  data: Record<string, unknown>;
}) {
  if (request.type === "kanji") {
    const kanji = stringValue(request.data.kanji);

    if (!kanji) {
      return {
        ok: false as const,
        message: "Kanji is required",
      };
    }

    await prisma.kanjiItem.update({
      where: { id: request.id },
      data: {
        kanji,
        hanViet: stringValue(request.data.hanViet),
        meaning: stringValue(request.data.meaning),
        kun: stringArrayValue(request.data.kun),
        on: stringArrayValue(request.data.on),
      },
    });
  }

  if (request.type === "vocabulary") {
    const word = stringValue(request.data.word);

    if (!word) {
      return {
        ok: false as const,
        message: "Word is required",
      };
    }

    await prisma.vocabularyItem.update({
      where: { id: request.id },
      data: {
        word,
        hanViet: stringValue(request.data.hanViet),
        type: vocabularyTypeValue(request.data.type),
        reading: stringValue(request.data.reading),
        meaning: stringValue(request.data.meaning),
      },
    });

    // Mirror the edit into the linked Anki note, if one exists. Fire-and-forget
    // from the user's perspective: a failure is logged, not surfaced, so the
    // DB edit still succeeds and the row keeps its "saved" badge. The user can
    // re-save from the Save to Anki button to retry.
    void pushVocabularyToAnki(request.id);
  }

  return {
    ok: true as const,
    data: await getTableData(),
  };
}

export async function deleteItem(request: {
  type: EditableItemType;
  id: string;
}) {
  let ankiVocabularyId: string | null = null;
  let ankiKanjiItemId: string | null = null;

  await prisma.$transaction(async (tx) => {
    if (request.type === "vocabulary") {
      const current = await tx.vocabularyItem.findUnique({
        where: { id: request.id },
        select: { kanjiItemId: true, ankiNoteId: true },
      });

      if (!current) {
        return;
      }

      ankiVocabularyId = current.ankiNoteId ? request.id : null;
      await tx.vocabularyItem.delete({ where: { id: request.id } });
      await reorderVocabularyForKanji(tx, current.kanjiItemId);
    }

    if (request.type === "kanji") {
      const current = await tx.kanjiItem.findUnique({
        where: { id: request.id },
        select: { groupId: true },
      });

      if (!current) {
        return;
      }

      ankiKanjiItemId = request.id;
      await tx.kanjiItem.delete({ where: { id: request.id } });
      await reorderKanjiForGroup(tx, current.groupId);
      await deleteEmptyGroupsAndReorder(tx);
    }
  });

  // Remove the corresponding Anki note(s) only after the DB commit succeeded, so
  // a failed Anki call cannot leave the app with a row that no longer exists.
  if (ankiVocabularyId) {
    await deleteAnkiNotesForVocabulary(ankiVocabularyId);
  }
  if (ankiKanjiItemId) {
    await deleteAnkiNotesForKanji(ankiKanjiItemId);
  }

  return {
    ok: true as const,
    data: await getTableData(),
  };
}

type TransactionClient = Prisma.TransactionClient;

async function moveGroupStep(groupId: string, direction: MoveDirection) {
  const groups = await prisma.group.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  const currentIndex = groups.findIndex((group) => group.id === groupId);
  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= groups.length) {
    return;
  }

  const orderedGroups = arrayMoveLocal(groups, currentIndex, nextIndex);
  await prisma.$transaction(
    orderedGroups.map((group, index) =>
      prisma.group.update({
        where: { id: group.id },
        data: { sortOrder: index },
      }),
    ),
  );
}

async function moveVocabularyStep(
  vocabularyId: string,
  direction: MoveDirection,
) {
  const current = await prisma.vocabularyItem.findUnique({
    where: { id: vocabularyId },
    select: { kanjiItemId: true },
  });

  if (!current) {
    return;
  }

  const rows = await prisma.vocabularyItem.findMany({
    where: { kanjiItemId: current.kanjiItemId },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  const currentIndex = rows.findIndex((row) => row.id === vocabularyId);
  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= rows.length) {
    return;
  }

  const orderedRows = arrayMoveLocal(rows, currentIndex, nextIndex);
  await prisma.$transaction(
    orderedRows.map((row, index) =>
      prisma.vocabularyItem.update({
        where: { id: row.id },
        data: { sortOrder: index },
      }),
    ),
  );
}

async function moveKanjiStep(kanjiId: string, direction: MoveDirection) {
  await prisma.$transaction(async (tx) => {
    const groups = await tx.group.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        kanjiItems: {
          orderBy: { sortOrder: "asc" },
          select: { id: true },
        },
      },
    });
    const nextGroups = groups.map((group) => ({
      id: group.id,
      kanjiIds: group.kanjiItems.map((item) => item.id),
      create: false,
    }));
    const sourceGroupIndex = nextGroups.findIndex((group) =>
      group.kanjiIds.includes(kanjiId),
    );

    if (sourceGroupIndex < 0) {
      return;
    }

    const sourceGroup = nextGroups[sourceGroupIndex];
    const sourceKanjiIndex = sourceGroup.kanjiIds.indexOf(kanjiId);

    if (direction === "up") {
      if (sourceKanjiIndex > 0) {
        sourceGroup.kanjiIds = arrayMoveLocal(
          sourceGroup.kanjiIds,
          sourceKanjiIndex,
          sourceKanjiIndex - 1,
        );
      } else if (sourceGroupIndex > 0) {
        sourceGroup.kanjiIds.splice(sourceKanjiIndex, 1);
        nextGroups[sourceGroupIndex - 1].kanjiIds.push(kanjiId);
      } else {
        return;
      }
    }

    if (direction === "down") {
      if (sourceKanjiIndex < sourceGroup.kanjiIds.length - 1) {
        sourceGroup.kanjiIds = arrayMoveLocal(
          sourceGroup.kanjiIds,
          sourceKanjiIndex,
          sourceKanjiIndex + 1,
        );
      } else {
        sourceGroup.kanjiIds.splice(sourceKanjiIndex, 1);

        if (sourceGroupIndex < nextGroups.length - 1) {
          nextGroups[sourceGroupIndex + 1].kanjiIds.unshift(kanjiId);
        } else {
          nextGroups.push({
            id: "__new_group__",
            kanjiIds: [kanjiId],
            create: true,
          });
        }
      }
    }

    const oldGroupIds = new Set(groups.map((group) => group.id));
    const orderedGroups = nextGroups.filter((group) => group.kanjiIds.length > 0);

    for (let index = 0; index < orderedGroups.length; index += 1) {
      const group = orderedGroups[index];

      if (group.create) {
        const created = await tx.group.create({
          data: { sortOrder: index },
          select: { id: true },
        });
        group.id = created.id;
      } else {
        await tx.group.update({
          where: { id: group.id },
          data: { sortOrder: index },
        });
      }

      await Promise.all(
        group.kanjiIds.map((id, sortOrder) =>
          tx.kanjiItem.update({
            where: { id },
            data: { groupId: group.id, sortOrder },
          }),
        ),
      );
    }

    const keptGroupIds = new Set(
      orderedGroups.filter((group) => !group.create).map((group) => group.id),
    );
    const emptyGroupIds = [...oldGroupIds].filter((id) => !keptGroupIds.has(id));

    if (emptyGroupIds.length > 0) {
      await tx.group.deleteMany({ where: { id: { in: emptyGroupIds } } });
    }
  });
}

async function getNextGroupOrder(tx: TransactionClient) {
  const highest = await tx.group.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return highest ? highest.sortOrder + 1 : 0;
}

async function reorderVocabularyForKanji(
  tx: TransactionClient,
  kanjiItemId: string,
) {
  const rows = await tx.vocabularyItem.findMany({
    where: { kanjiItemId },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });

  await Promise.all(
    rows.map((row, index) =>
      tx.vocabularyItem.update({
        where: { id: row.id },
        data: { sortOrder: index },
      }),
    ),
  );
}

async function reorderKanjiForGroup(tx: TransactionClient, groupId: string) {
  const rows = await tx.kanjiItem.findMany({
    where: { groupId },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });

  await Promise.all(
    rows.map((row, index) =>
      tx.kanjiItem.update({
        where: { id: row.id },
        data: { sortOrder: index },
      }),
    ),
  );
}

async function deleteEmptyGroupsAndReorder(tx: TransactionClient) {
  const groups = await tx.group.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      kanjiItems: {
        select: { id: true },
      },
    },
  });
  const emptyGroupIds = groups
    .filter((group) => group.kanjiItems.length === 0)
    .map((group) => group.id);

  if (emptyGroupIds.length > 0) {
    await tx.group.deleteMany({ where: { id: { in: emptyGroupIds } } });
  }

  const remainingGroups = groups.filter(
    (group) => !emptyGroupIds.includes(group.id),
  );

  await Promise.all(
    remainingGroups.map((group, index) =>
      tx.group.update({
        where: { id: group.id },
        data: { sortOrder: index },
      }),
    ),
  );
}

async function createNewKanjiGroup(
  tx: TransactionClient,
  item: KanjiImportItem,
  groupOrder: number,
) {
  await tx.group.create({
    data: {
      sortOrder: groupOrder,
      kanjiItems: {
        create: {
          sortOrder: 0,
          kanji: item.kanji,
          hanViet: item.han_viet,
          meaning: item.meaning,
          kun: item.kun,
          on: item.on,
          vocabulary: {
            create: item.vocabulary.map((vocabulary, index) => ({
              sortOrder: index,
              ...vocabularyData(vocabulary),
            })),
          },
        },
      },
    },
  });
}

async function createVocabulary(
  tx: TransactionClient,
  kanjiItemId: string,
  vocabulary: VocabularyImportItem,
  sortOrder: number,
) {
  await tx.vocabularyItem.create({
    data: {
      kanjiItemId,
      sortOrder,
      ...vocabularyData(vocabulary),
    },
  });
}

function vocabularyData(vocabulary: VocabularyImportItem) {
  return {
    word: vocabulary.word,
    hanViet: vocabulary.han_viet,
    type: vocabulary.type,
    reading: vocabulary.reading,
    meaning: vocabulary.meaning,
    exampleJapanese: vocabulary.example.japanese,
    exampleVietnamese: vocabulary.example.vietnamese,
  };
}

function serializeKanjiItem(item: {
  id: string;
  groupId: string;
  sortOrder: number;
  kanji: string;
  hanViet: string;
  meaning: string;
  kun: unknown;
  on: unknown;
  vocabulary: Array<{
    id: string;
    sortOrder: number;
    word: string;
    hanViet: string;
    type: string;
    reading: string;
    meaning: string;
    exampleJapanese: unknown;
    exampleVietnamese: string;
    ankiNoteId: number | bigint | null;
  }>;
}): KanjiBlock {
  return {
    id: item.id,
    groupId: item.groupId,
    sortOrder: item.sortOrder,
    kanji: item.kanji,
    hanViet: item.hanViet,
    meaning: item.meaning,
    kun: asStringArray(item.kun),
    on: asStringArray(item.on),
    vocabulary: item.vocabulary.map(serializeVocabularyItem),
  };
}

function serializeVocabularyItem(item: {
  id: string;
  sortOrder: number;
  word: string;
  hanViet: string;
  type: string;
  reading: string;
  meaning: string;
  exampleJapanese: unknown;
  exampleVietnamese: string;
  ankiNoteId: number | bigint | null;
}): VocabularyRow {
  return {
    id: item.id,
    sortOrder: item.sortOrder,
    word: item.word,
    hanViet: item.hanViet,
    type: vocabularyTypeValue(item.type),
    reading: item.reading,
    meaning: item.meaning,
    exampleJapanese: asExampleTokens(item.exampleJapanese),
    exampleVietnamese: item.exampleVietnamese,
    ankiNoteId: numberOrNull(item.ankiNoteId),
  };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function asExampleTokens(value: unknown): ExampleToken[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null && typeof item.text === "string",
    )
    .map((item) => ({
      text: String(item.text),
      reading: typeof item.reading === "string" ? item.reading : undefined,
      is_target: item.is_target === true,
    }));
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value: number | bigint | null) {
  return value === null ? null : Number(value);
}

function vocabularyTypeValue(value: unknown): VocabularyType {
  return typeof value === "string" &&
    VOCABULARY_TYPES.includes(value as VocabularyType)
    ? (value as VocabularyType)
    : "danh từ";
}

function stringArrayValue(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayMoveLocal<T>(items: T[], oldIndex: number, newIndex: number) {
  const next = [...items];
  const [item] = next.splice(oldIndex, 1);
  next.splice(newIndex, 0, item);
  return next;
}

// Anki push/pull helpers. These never throw into the caller's DB flow: an Anki
// outage must not block editing or deleting a word in the app. They log the
// failure so the user can re-save later.

export async function pushVocabularyToAnki(vocabularyId: string): Promise<void> {
  const row = await prisma.vocabularyItem.findUnique({
    where: { id: vocabularyId },
    include: { kanjiItem: { select: { kanji: true, hanViet: true } } },
  });

  if (!row || !row.ankiNoteId) {
    return;
  }

  try {
    await ankiUpdateNoteFields({
      id: Number(row.ankiNoteId),
      fields: buildAnkiFields({
        kanji: row.kanjiItem.kanji,
        word: row.word,
        hanViet: row.hanViet || row.kanjiItem.hanViet,
        type: row.type as Parameters<typeof buildAnkiFields>[0]["type"],
        reading: row.reading,
        meaning: row.meaning,
        exampleJapanese:
          row.exampleJapanese as Parameters<typeof buildAnkiFields>[0]["exampleJapanese"],
        exampleVietnamese: row.exampleVietnamese,
      }),
    });
  } catch (error) {
    logAnkiError("update note", error);
  }
}

export async function deleteAnkiNotesForVocabulary(
  vocabularyId: string,
): Promise<void> {
  const row = await prisma.vocabularyItem.findUnique({
    where: { id: vocabularyId },
    select: { ankiNoteId: true },
  });

  if (!row?.ankiNoteId) {
    return;
  }

  try {
    await ankiDeleteNotes([Number(row.ankiNoteId)]);
  } catch (error) {
    logAnkiError("delete note", error);
  }
}

export async function deleteAnkiNotesForKanji(kanjiItemId: string): Promise<void> {
  const rows = await prisma.vocabularyItem.findMany({
    where: { kanjiItemId, NOT: { ankiNoteId: null } },
    select: { ankiNoteId: true },
  });
  const noteIds = rows
    .map((row) => row.ankiNoteId)
    .filter((id): id is bigint => id !== null)
    .map((id) => Number(id));

  if (noteIds.length === 0) {
    return;
  }

  try {
    await ankiDeleteNotes(noteIds);
  } catch (error) {
    logAnkiError("delete notes", error);
  }
}

function logAnkiError(action: string, error: unknown) {
  const message =
    error instanceof AnkiConnectError
      ? error.message
      : error instanceof Error
        ? error.message
        : String(error);
  console.warn(`[anki] failed to ${action}: ${message}`);
}
