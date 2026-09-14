import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ankiDeleteNotes, ankiUpdateNoteFields, buildStandaloneVocabularyAnkiFields } from "@/lib/anki";
import { AnkiConnectError } from "@/lib/anki";
import { VOCABULARY_TYPES } from "@/lib/types";
import type {
  ExampleToken,
  MoveDirection,
  StandaloneVocabularyData,
  StandaloneVocabularyGroup,
  StandaloneVocabularyImportItem,
  StandaloneVocabularyImportPreview,
  StandaloneVocabularyRow,
  VocabularyExample,
  VocabularyType,
} from "@/lib/types";

type TransactionClient = Prisma.TransactionClient;

export async function getStandaloneVocabularyData(): Promise<StandaloneVocabularyData> {
  const groups = await prisma.vocabGroup.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      vocabulary: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return {
    groups: groups.map(serializeVocabGroup),
  };
}

export function buildStandaloneVocabularyPreview(
  payload: {
    group_name?: string;
    vocabulary: StandaloneVocabularyImportItem[];
  },
  fallbackGroupName: string,
): StandaloneVocabularyImportPreview {
  const groupName = cleanGroupName(payload.group_name) || fallbackGroupName;

  return {
    groupName,
    vocabulary: payload.vocabulary,
    summary: {
      vocabulary: payload.vocabulary.length,
      examples: payload.vocabulary.reduce(
        (count, item) => count + item.examples.length,
        0,
      ),
    },
  };
}

export async function getNextVocabularyGroupName() {
  const groups = await prisma.vocabGroup.findMany({
    select: { name: true },
  });
  return nextGroupName(groups.map((group) => group.name));
}

export async function commitStandaloneVocabularyImport(raw: string) {
  const { parseStandaloneVocabularyImportJson } = await import(
    "@/lib/vocab-validation"
  );
  const parsed = parseStandaloneVocabularyImportJson(raw);

  if (!parsed.ok) {
    return {
      ok: false as const,
      errors: parsed.errors,
    };
  }

  await prisma.$transaction(async (tx) => {
    const groupName =
      cleanGroupName(parsed.payload.group_name) ||
      nextGroupName(
        (await tx.vocabGroup.findMany({ select: { name: true } })).map(
          (group) => group.name,
        ),
      );
    const sortOrder = await getNextVocabGroupOrder(tx);

    await tx.vocabGroup.create({
      data: {
        name: groupName,
        sortOrder,
        isCollapsed: false,
        vocabulary: {
          create: parsed.payload.vocabulary.map((item, index) => ({
            sortOrder: index,
            ...standaloneVocabularyData(item),
          })),
        },
      },
    });
  });

  return {
    ok: true as const,
    data: await getStandaloneVocabularyData(),
  };
}

export async function setAllVocabGroupsCollapsed(isCollapsed: boolean) {
  await prisma.vocabGroup.updateMany({
    data: { isCollapsed },
  });

  return getStandaloneVocabularyData();
}

export async function setVocabGroupCollapsed(
  groupId: string,
  isCollapsed: boolean,
) {
  await prisma.vocabGroup.update({
    where: { id: groupId },
    data: { isCollapsed },
  });
}

export async function renameVocabGroup(groupId: string, name: string) {
  const cleaned = cleanGroupName(name);

  if (!cleaned) {
    return {
      ok: false as const,
      message: "Group name is required",
    };
  }

  await prisma.vocabGroup.update({
    where: { id: groupId },
    data: { name: cleaned },
  });

  return {
    ok: true as const,
    data: await getStandaloneVocabularyData(),
  };
}

export async function moveVocabGroupStep(groupId: string, direction: MoveDirection) {
  const groups = await prisma.vocabGroup.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  const currentIndex = groups.findIndex((group) => group.id === groupId);
  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= groups.length) {
    return getStandaloneVocabularyData();
  }

  const orderedGroups = arrayMoveLocal(groups, currentIndex, nextIndex);
  await prisma.$transaction(
    orderedGroups.map((group, index) =>
      prisma.vocabGroup.update({
        where: { id: group.id },
        data: { sortOrder: index },
      }),
    ),
  );

  return getStandaloneVocabularyData();
}

export async function moveStandaloneVocabularyStep(
  vocabularyId: string,
  direction: MoveDirection,
) {
  await prisma.$transaction(async (tx) => {
    const groups = await tx.vocabGroup.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        vocabulary: {
          orderBy: { sortOrder: "asc" },
          select: { id: true },
        },
      },
    });
    const nextGroups = groups.map((group) => ({
      id: group.id,
      itemIds: group.vocabulary.map((item) => item.id),
      name: group.name,
      create: false,
    }));
    const sourceGroupIndex = nextGroups.findIndex((group) =>
      group.itemIds.includes(vocabularyId),
    );

    if (sourceGroupIndex < 0) {
      return;
    }

    const sourceGroup = nextGroups[sourceGroupIndex];
    const sourceItemIndex = sourceGroup.itemIds.indexOf(vocabularyId);

    if (direction === "up") {
      if (sourceItemIndex > 0) {
        sourceGroup.itemIds = arrayMoveLocal(
          sourceGroup.itemIds,
          sourceItemIndex,
          sourceItemIndex - 1,
        );
      } else if (sourceGroupIndex > 0) {
        sourceGroup.itemIds.splice(sourceItemIndex, 1);
        nextGroups[sourceGroupIndex - 1].itemIds.push(vocabularyId);
      } else {
        return;
      }
    }

    if (direction === "down") {
      if (sourceItemIndex < sourceGroup.itemIds.length - 1) {
        sourceGroup.itemIds = arrayMoveLocal(
          sourceGroup.itemIds,
          sourceItemIndex,
          sourceItemIndex + 1,
        );
      } else if (sourceGroupIndex < nextGroups.length - 1) {
        sourceGroup.itemIds.splice(sourceItemIndex, 1);
        nextGroups[sourceGroupIndex + 1].itemIds.unshift(vocabularyId);
      } else {
        return;
      }
    }

    const orderedGroups = nextGroups.filter((group) => group.itemIds.length > 0);
    const keptGroupIds = new Set(orderedGroups.map((group) => group.id));

    for (let index = 0; index < orderedGroups.length; index += 1) {
      const group = orderedGroups[index];
      await tx.vocabGroup.update({
        where: { id: group.id },
        data: { sortOrder: index },
      });

      await Promise.all(
        group.itemIds.map((id, sortOrder) =>
          tx.standaloneVocabularyItem.update({
            where: { id },
            data: { groupId: group.id, sortOrder },
          }),
        ),
      );
    }

    const emptyGroupIds = groups
      .map((group) => group.id)
      .filter((id) => !keptGroupIds.has(id));

    if (emptyGroupIds.length > 0) {
      await tx.vocabGroup.deleteMany({ where: { id: { in: emptyGroupIds } } });
    }
  });

  return getStandaloneVocabularyData();
}

export async function updateStandaloneVocabularyItem(request: {
  id: string;
  data: Record<string, unknown>;
}) {
  const word = stringValue(request.data.word);

  if (!word) {
    return {
      ok: false as const,
      message: "Word is required",
    };
  }

  await prisma.standaloneVocabularyItem.update({
    where: { id: request.id },
    data: {
      word,
      hanViet: stringValue(request.data.hanViet),
      type: vocabularyTypeValue(request.data.type),
      reading: stringValue(request.data.reading),
      meaning: stringValue(request.data.meaning),
    },
  });

  void pushStandaloneVocabularyToAnki(request.id);

  return {
    ok: true as const,
    data: await getStandaloneVocabularyData(),
  };
}

export async function deleteStandaloneVocabularyItem(id: string) {
  let ankiVocabularyId: string | null = null;

  await prisma.$transaction(async (tx) => {
    const current = await tx.standaloneVocabularyItem.findUnique({
      where: { id },
      select: { groupId: true, ankiNoteId: true },
    });

    if (!current) {
      return;
    }

    ankiVocabularyId = current.ankiNoteId ? id : null;
    await tx.standaloneVocabularyItem.delete({ where: { id } });
    await reorderStandaloneVocabularyForGroup(tx, current.groupId);
    await deleteEmptyVocabGroupsAndReorder(tx);
  });

  if (ankiVocabularyId) {
    await deleteAnkiNotesForStandaloneVocabulary(ankiVocabularyId);
  }

  return {
    ok: true as const,
    data: await getStandaloneVocabularyData(),
  };
}

export async function createStandaloneVocabularyAttempt(request: {
  vocabularyItemId: string;
  mode: "reading" | "writing";
  answer: string;
  isCorrect: boolean;
}) {
  await prisma.standaloneVocabularyAttempt.create({
    data: request,
  });
}

export async function pushStandaloneVocabularyToAnki(
  vocabularyId: string,
): Promise<void> {
  const row = await prisma.standaloneVocabularyItem.findUnique({
    where: { id: vocabularyId },
  });

  if (!row || !row.ankiNoteId) {
    return;
  }

  try {
    await ankiUpdateNoteFields({
      id: Number(row.ankiNoteId),
      fields: buildStandaloneVocabularyAnkiFields({
        word: row.word,
        hanViet: row.hanViet,
        type: vocabularyTypeValue(row.type),
        reading: row.reading,
        meaning: row.meaning,
        examples: asVocabularyExamples(row.examples),
      }),
    });
  } catch (error) {
    logAnkiError("update standalone vocabulary note", error);
  }
}

export async function deleteAnkiNotesForStandaloneVocabulary(
  vocabularyId: string,
): Promise<void> {
  const row = await prisma.standaloneVocabularyItem.findUnique({
    where: { id: vocabularyId },
    select: { ankiNoteId: true },
  });

  if (!row?.ankiNoteId) {
    return;
  }

  try {
    await ankiDeleteNotes([Number(row.ankiNoteId)]);
  } catch (error) {
    logAnkiError("delete standalone vocabulary note", error);
  }
}

async function getNextVocabGroupOrder(tx: TransactionClient) {
  const highest = await tx.vocabGroup.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return highest ? highest.sortOrder + 1 : 0;
}

async function reorderStandaloneVocabularyForGroup(
  tx: TransactionClient,
  groupId: string,
) {
  const rows = await tx.standaloneVocabularyItem.findMany({
    where: { groupId },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });

  await Promise.all(
    rows.map((row, index) =>
      tx.standaloneVocabularyItem.update({
        where: { id: row.id },
        data: { sortOrder: index },
      }),
    ),
  );
}

async function deleteEmptyVocabGroupsAndReorder(tx: TransactionClient) {
  const groups = await tx.vocabGroup.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      vocabulary: {
        select: { id: true },
      },
    },
  });
  const emptyGroupIds = groups
    .filter((group) => group.vocabulary.length === 0)
    .map((group) => group.id);

  if (emptyGroupIds.length > 0) {
    await tx.vocabGroup.deleteMany({ where: { id: { in: emptyGroupIds } } });
  }

  const remainingGroups = groups.filter(
    (group) => !emptyGroupIds.includes(group.id),
  );

  await Promise.all(
    remainingGroups.map((group, index) =>
      tx.vocabGroup.update({
        where: { id: group.id },
        data: { sortOrder: index },
      }),
    ),
  );
}

function standaloneVocabularyData(vocabulary: StandaloneVocabularyImportItem) {
  return {
    word: vocabulary.word,
    hanViet: vocabulary.han_viet,
    type: vocabulary.type,
    reading: vocabulary.reading,
    meaning: vocabulary.meaning,
    examples: vocabulary.examples,
  };
}

function serializeVocabGroup(group: {
  id: string;
  name: string;
  sortOrder: number;
  isCollapsed: boolean;
  vocabulary: Array<{
    id: string;
    groupId: string;
    sortOrder: number;
    word: string;
    hanViet: string;
    type: string;
    reading: string;
    meaning: string;
    examples: unknown;
    ankiNoteId: number | bigint | null;
  }>;
}): StandaloneVocabularyGroup {
  return {
    id: group.id,
    name: group.name,
    sortOrder: group.sortOrder,
    isCollapsed: group.isCollapsed,
    vocabulary: group.vocabulary.map(serializeStandaloneVocabularyItem),
  };
}

function serializeStandaloneVocabularyItem(item: {
  id: string;
  groupId: string;
  sortOrder: number;
  word: string;
  hanViet: string;
  type: string;
  reading: string;
  meaning: string;
  examples: unknown;
  ankiNoteId: number | bigint | null;
}): StandaloneVocabularyRow {
  return {
    id: item.id,
    groupId: item.groupId,
    sortOrder: item.sortOrder,
    word: item.word,
    hanViet: item.hanViet,
    type: vocabularyTypeValue(item.type),
    reading: item.reading,
    meaning: item.meaning,
    examples: asVocabularyExamples(item.examples),
    ankiNoteId: numberOrNull(item.ankiNoteId),
  };
}

export function asVocabularyExamples(value: unknown): VocabularyExample[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" &&
        item !== null &&
        Array.isArray(item.japanese) &&
        typeof item.vietnamese === "string",
    )
    .map((item) => ({
      japanese: asExampleTokens(item.japanese),
      vietnamese: item.vietnamese as string,
    }));
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

function nextGroupName(existingNames: string[]) {
  const names = new Set(existingNames);

  if (!names.has("New group")) {
    return "New group";
  }

  let index = 1;
  while (names.has(`New group ${index}`)) {
    index += 1;
  }

  return `New group ${index}`;
}

function cleanGroupName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

function arrayMoveLocal<T>(items: T[], oldIndex: number, newIndex: number) {
  const next = [...items];
  const [item] = next.splice(oldIndex, 1);
  next.splice(newIndex, 0, item);
  return next;
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
