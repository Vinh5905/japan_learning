"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsRight,
  Clipboard,
  Eye,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AI_PROMPT, COLUMNS } from "@/lib/constants";
import { checkAnswer } from "@/lib/study";
import {
  VOCABULARY_TYPES,
  type ColumnKey,
  type DuplicateKanjiPreview,
  type DuplicateVocabularyPreview,
  type EditableItemType,
  type ImportPreview,
  type KanjiDuplicateDecision,
  type KanjiBlock,
  type KanjiGroup,
  type KanjiImportItem,
  type MoveDirection,
  type MoveTargetType,
  type StudyMode,
  type TableData,
  type VocabularyDuplicateDecision,
  type VocabularyRow,
  type VocabularyType,
} from "@/lib/types";
import { ExampleText } from "@/components/ExampleText";

type AnswerState = {
  value: string;
  status: "neutral" | "correct" | "wrong";
  revealed: boolean;
};

type TestMode = Extract<StudyMode, "reading" | "writing">;

type DragData =
  | { type: "group"; groupId: string }
  | { type: "kanji"; kanjiId: string; groupId: string }
  | {
      type: "vocab";
      vocabularyId: string;
      kanjiItemId: string;
      groupId: string;
    };

type MoveItemHandler = (
  type: MoveTargetType,
  id: string,
  direction: MoveDirection,
) => void;

type EditTarget =
  | { type: "kanji"; item: KanjiBlock }
  | { type: "vocabulary"; row: VocabularyRow };

type DeleteTarget =
  | { type: "kanji"; item: KanjiBlock }
  | { type: "vocabulary"; row: VocabularyRow };

type EditDraft = {
  kanji: string;
  hanViet: string;
  meaning: string;
  kunText: string;
  onText: string;
  word: string;
  wordHanViet: string;
  type: VocabularyType;
  reading: string;
};

type EditHandler = (target: EditTarget) => void;

type DeleteHandler = (target: DeleteTarget) => void;

const EMPTY_EDIT_DRAFT: EditDraft = {
  kanji: "",
  hanViet: "",
  meaning: "",
  kunText: "",
  onText: "",
  word: "",
  wordHanViet: "",
  type: "danh từ",
  reading: "",
};

const ANSWER_STORAGE_KEY = "kanji-spreadsheet-answer-state:v1";

const EMPTY_IMPORT = "";

type AnkiStatus = {
  reachable: boolean;
  deckReady: boolean;
  modelReady: boolean;
  message?: string;
  deckName?: string;
  modelName?: string;
};

type AnkiResetStep = "none" | "first" | "second";

export function KanjiApp({ initialData }: { initialData: TableData }) {
  const [data, setData] = useState<TableData>(() =>
    withAllGroupsCollapsed(initialData, true),
  );
  const [mode, setMode] = useState<StudyMode>("study");
  const [rawImport, setRawImport] = useState(EMPTY_IMPORT);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    Array<{ path: string; message: string }>
  >([]);
  const [kanjiDecisions, setKanjiDecisions] = useState<
    Record<string, KanjiDuplicateDecision>
  >({});
  const [vocabularyDecisions, setVocabularyDecisions] = useState<
    Record<string, VocabularyDuplicateDecision>
  >({});
  const [answers, setAnswers] = useState<Record<string, AnswerState>>(
    loadStoredAnswers,
  );
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>(EMPTY_EDIT_DRAFT);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [ankiStatus, setAnkiStatus] = useState<AnkiStatus | null>(null);
  const [isAnkiDialogOpen, setIsAnkiDialogOpen] = useState(false);
  const [ankiResetStep, setAnkiResetStep] = useState<AnkiResetStep>("none");
  const [isAnkiBusy, setIsAnkiBusy] = useState(false);
  const [ankiMessage, setAnkiMessage] = useState("");
  const [savingAnkiIds, setSavingAnkiIds] = useState<Set<string>>(new Set());
  const [hoveredKanjiId, setHoveredKanjiId] = useState<string | null>(null);
  const [hoveredVocabularyId, setHoveredVocabularyId] = useState<string | null>(
    null,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const loadData = useCallback(async () => {
    const next = await requestJson<TableData>("/api/data");
    setData(next);
  }, []);

  const sortableItems = useMemo(() => {
    const items: string[] = [];

    for (const group of data.groups) {
      items.push(groupDragId(group.id));
      for (const kanji of group.kanjiItems) {
        items.push(kanjiDragId(kanji.id));
        for (const row of kanji.vocabulary) {
          items.push(vocabularyDragId(row.id));
        }
      }
    }

    return items;
  }, [data.groups]);

  const visibleColumns = useMemo(
    () =>
      COLUMNS.filter((column) =>
        isColumnVisible(column.key, data.columnSettings, mode),
      ),
    [data.columnSettings, mode],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(ANSWER_STORAGE_KEY, JSON.stringify(answers));
  }, [answers]);

  async function validateImport() {
    setIsBusy(true);
    setMessage("");
    setValidationErrors([]);

    try {
      const response = await requestJson<{
        ok: true;
        preview: ImportPreview;
      }>("/api/import/validate", {
        method: "POST",
        body: JSON.stringify({ raw: rawImport }),
      });

      setPreview(response.preview);
      setKanjiDecisions(
        Object.fromEntries(
          response.preview.duplicateKanji.map((item) => [
            item.kanji,
            "keep_old",
          ]),
        ),
      );
      setVocabularyDecisions(
        Object.fromEntries(
          response.preview.duplicateKanji.flatMap((item) =>
            item.duplicateVocabulary.map((duplicate) => [
              duplicate.id,
              "keep_old",
            ]),
          ),
        ),
      );
      setMessage("JSON is valid. Review the import preview before importing.");
    } catch (error) {
      const apiError = error as ApiError;
      setPreview(null);
      setValidationErrors(apiError.errors ?? []);
      setMessage(apiError.message || "Validation failed");
    } finally {
      setIsBusy(false);
    }
  }

  async function commitImport() {
    setIsBusy(true);
    setMessage("");

    try {
      const response = await requestJson<{ ok: true; data: TableData }>(
        "/api/import/commit",
        {
          method: "POST",
          body: JSON.stringify({
            raw: rawImport,
            kanjiDecisions,
            vocabularyDecisions,
          }),
        },
      );
      setData(withAllGroupsCollapsed(response.data, true));
      setPreview(null);
      setValidationErrors([]);
      setIsImportOpen(false);
      setMessage("Import completed.");
    } catch (error) {
      const apiError = error as ApiError;
      setValidationErrors(apiError.errors ?? []);
      setMessage(apiError.message || "Import failed");
    } finally {
      setIsBusy(false);
    }
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(AI_PROMPT);
    setMessage("AI prompt copied.");
  }

  function changeColumn(columnKey: ColumnKey, isVisible: boolean) {
    const nextSettings = {
      ...data.columnSettings,
      [columnKey]: isVisible,
    };

    setData((current) => ({ ...current, columnSettings: nextSettings }));
    requestJson("/api/columns", {
      method: "PATCH",
      body: JSON.stringify({ settings: { [columnKey]: isVisible } }),
    }).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : "Failed to save columns");
    });
  }

  async function toggleGroup(group: KanjiGroup) {
    const isCollapsed = !group.isCollapsed;
    setData((current) => ({
      ...current,
      groups: current.groups.map((item) =>
        item.id === group.id ? { ...item, isCollapsed } : item,
      ),
    }));

    try {
      await requestJson("/api/groups/collapse", {
        method: "PATCH",
        body: JSON.stringify({ groupId: group.id, isCollapsed }),
      });
    } catch {
      await loadData();
    }
  }

  async function changeAllGroupsCollapsed(isCollapsed: boolean) {
    setIsBusy(true);
    setMessage("");
    setData((current) => withAllGroupsCollapsed(current, isCollapsed));

    try {
      const response = await requestJson<{ ok: true; data: TableData }>(
        "/api/groups/collapse-all",
        {
          method: "PATCH",
          body: JSON.stringify({ isCollapsed }),
        },
      );
      setData(response.data);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : isCollapsed
            ? "Failed to collapse groups"
            : "Failed to expand groups",
      );
      await loadData();
    } finally {
      setIsBusy(false);
    }
  }

  async function moveItem(
    type: MoveTargetType,
    id: string,
    direction: MoveDirection,
  ) {
    try {
      const response = await requestJson<{ ok: true; data: TableData }>(
        "/api/items/move-step",
        {
          method: "PATCH",
          body: JSON.stringify({ type, id, direction }),
        },
      );
      setData(response.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to move item");
      await loadData();
    }
  }

  function openEdit(target: EditTarget) {
    setEditTarget(target);
    setMessage("");

    if (target.type === "kanji") {
      setEditDraft({
        kanji: target.item.kanji,
        hanViet: target.item.hanViet,
        meaning: target.item.meaning,
        kunText: target.item.kun.join(", "),
        onText: target.item.on.join(", "),
        word: "",
        wordHanViet: "",
        type: "danh từ",
        reading: "",
      });
      return;
    }

    setEditDraft({
      ...EMPTY_EDIT_DRAFT,
      word: target.row.word,
      wordHanViet: target.row.hanViet,
      type: target.row.type,
      reading: target.row.reading,
      meaning: target.row.meaning,
    });
  }

  async function saveEdit() {
    if (!editTarget) {
      return;
    }

    setIsBusy(true);
    setMessage("");

    const isKanji = editTarget.type === "kanji";
    const body = isKanji
      ? {
          type: "kanji" satisfies EditableItemType,
          id: editTarget.item.id,
          data: {
            kanji: editDraft.kanji,
            hanViet: editDraft.hanViet,
            meaning: editDraft.meaning,
            kun: splitList(editDraft.kunText),
            on: splitList(editDraft.onText),
          },
        }
      : {
          type: "vocabulary" satisfies EditableItemType,
          id: editTarget.row.id,
          data: {
            word: editDraft.word,
            hanViet: editDraft.wordHanViet,
            type: editDraft.type,
            reading: editDraft.reading,
            meaning: editDraft.meaning,
          },
        };

    try {
      const response = await requestJson<{ ok: true; data: TableData }>(
        "/api/items/edit",
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
      );
      setData(response.data);
      setEditTarget(null);
      setMessage(`${isKanji ? "Kanji" : "Word"} updated.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save edit");
    } finally {
      setIsBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    setIsBusy(true);
    setMessage("");

    const isKanji = deleteTarget.type === "kanji";
    const id = isKanji ? deleteTarget.item.id : deleteTarget.row.id;

    try {
      const response = await requestJson<{ ok: true; data: TableData }>(
        "/api/items/delete",
        {
          method: "DELETE",
          body: JSON.stringify({
            type: isKanji ? "kanji" : "vocabulary",
            id,
          }),
        },
      );
      setData(response.data);
      setDeleteTarget(null);
      setMessage(`${isKanji ? "Kanji" : "Word"} deleted.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete item");
    } finally {
      setIsBusy(false);
    }
  }

  const refreshAnkiStatus = useCallback(async () => {
    setAnkiStatus(await fetchAnkiStatus());
  }, []);

  useEffect(() => {
    let active = true;
    fetchAnkiStatus().then((status) => {
      if (active) {
        setAnkiStatus(status);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const ankiReady = Boolean(ankiStatus?.reachable && ankiStatus?.deckReady && ankiStatus?.modelReady);
  const ankiProgress = useMemo(() => {
    let total = 0;
    let saved = 0;

    for (const group of data.groups) {
      for (const kanji of group.kanjiItems) {
        for (const row of kanji.vocabulary) {
          total += 1;
          if (row.ankiNoteId) {
            saved += 1;
          }
        }
      }
    }

    return { total, saved };
  }, [data.groups]);

  async function setupAnki() {
    setIsAnkiBusy(true);
    setAnkiMessage("");
    try {
      const response = await requestJson<{
        ok: boolean;
        steps?: string[];
        message?: string;
      }>("/api/anki/setup", { method: "POST" });
      setAnkiMessage(response.steps?.join(" ") || "Anki setup complete.");
      await refreshAnkiStatus();
    } catch (error) {
      setAnkiMessage(error instanceof Error ? error.message : "Anki setup failed");
    } finally {
      setIsAnkiBusy(false);
    }
  }

  async function syncAnki() {
    setIsAnkiBusy(true);
    setAnkiMessage("");
    try {
      await requestJson<{ ok: boolean }>("/api/anki/sync", { method: "POST" });
      setAnkiMessage("Anki sync started in Anki desktop.");
    } catch (error) {
      setAnkiMessage(error instanceof Error ? error.message : "Anki sync failed");
    } finally {
      setIsAnkiBusy(false);
    }
  }

  async function resetAnkiSavedData() {
    setIsAnkiBusy(true);
    setAnkiMessage("");
    try {
      const response = await requestJson<{
        ok: boolean;
        deckFound: boolean;
        deletedNotes: number;
        clearedRows: number;
      }>("/api/anki/reset", {
        method: "POST",
        body: JSON.stringify({
          confirmDeckReset: true,
          confirmDatabaseReset: true,
        }),
      });

      setData(clearAllVocabularyAnkiIds);
      setAnkiResetStep("none");
      setAnkiMessage(
        response.deckFound
          ? `Reset complete. Deleted ${response.deletedNotes} Anki note(s) and cleared ${response.clearedRows} saved row(s).`
          : `Reset complete. Deck was not found in Anki; cleared ${response.clearedRows} saved row(s).`,
      );
      await refreshAnkiStatus();
    } catch (error) {
      setAnkiMessage(
        error instanceof Error ? error.message : "Failed to reset Anki saved data",
      );
    } finally {
      setIsAnkiBusy(false);
    }
  }

  async function saveToAnki(row: VocabularyRow) {
    setSavingAnkiIds((current) => new Set(current).add(row.id));
    try {
      const response = await requestJson<{ ok: boolean; ankiNoteId?: number; message?: string }>(
        "/api/anki/save",
        {
          method: "POST",
          body: JSON.stringify({ vocabularyId: row.id }),
        },
      );
      setData((current) => replaceVocabularyAnkiId(current, row.id, response.ankiNoteId ?? null));
      setMessage(`Saved "${row.word}" to Anki.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save to Anki");
    } finally {
      setSavingAnkiIds((current) => {
        const next = new Set(current);
        next.delete(row.id);
        return next;
      });
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const activeData = event.active.data.current as DragData | undefined;
    const overData = event.over?.data.current as DragData | undefined;

    if (!activeData || !overData || event.active.id === event.over?.id) {
      return;
    }

    if (activeData.type === "group") {
      await reorderGroups(activeData.groupId, getGroupId(overData));
      return;
    }

    if (activeData.type === "kanji") {
      await moveKanji(activeData, overData);
      return;
    }

    if (activeData.type === "vocab" && overData.type === "vocab") {
      await reorderVocabulary(activeData, overData);
    }
  }

  async function reorderGroups(activeGroupId: string, overGroupId: string) {
    if (activeGroupId === overGroupId) {
      return;
    }

    const oldIndex = data.groups.findIndex((group) => group.id === activeGroupId);
    const newIndex = data.groups.findIndex((group) => group.id === overGroupId);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const groups = arrayMove(data.groups, oldIndex, newIndex).map(
      (group, index) => ({
        ...group,
        sortOrder: index,
      }),
    );
    setData((current) => ({ ...current, groups }));

    try {
      await requestJson("/api/groups/reorder", {
        method: "PATCH",
        body: JSON.stringify({ groupIds: groups.map((group) => group.id) }),
      });
    } catch {
      await loadData();
    }
  }

  async function moveKanji(activeData: Extract<DragData, { type: "kanji" }>, overData: DragData) {
    const targetGroupId = getGroupId(overData);
    const sourceGroup = data.groups.find((group) => group.id === activeData.groupId);
    const targetGroup = data.groups.find((group) => group.id === targetGroupId);

    if (!sourceGroup || !targetGroup) {
      return;
    }

    const movingKanji = sourceGroup.kanjiItems.find(
      (item) => item.id === activeData.kanjiId,
    );

    if (!movingKanji) {
      return;
    }

    const targetIndex =
      overData.type === "kanji"
        ? targetGroup.kanjiItems.findIndex((item) => item.id === overData.kanjiId)
        : targetGroup.kanjiItems.length;

    let sourceIds: string[] = [];
    let targetIds: string[] = [];
    const groups = data.groups.map((group) => {
      if (group.id === sourceGroup.id) {
        const remaining = group.kanjiItems.filter(
          (item) => item.id !== movingKanji.id,
        );
        sourceIds = remaining.map((item) => item.id);

        if (sourceGroup.id !== targetGroup.id) {
          return { ...group, kanjiItems: remaining };
        }

        const reordered = insertAt(remaining, targetIndex, {
          ...movingKanji,
          groupId: targetGroup.id,
        }).map((item, index) => ({ ...item, sortOrder: index }));
        targetIds = reordered.map((item) => item.id);
        sourceIds = targetIds;
        return { ...group, kanjiItems: reordered };
      }

      if (group.id === targetGroup.id) {
        const inserted = insertAt(group.kanjiItems, targetIndex, {
          ...movingKanji,
          groupId: targetGroup.id,
        }).map((item, index) => ({ ...item, sortOrder: index }));
        targetIds = inserted.map((item) => item.id);
        return { ...group, kanjiItems: inserted };
      }

      return group;
    });

    setData((current) => ({ ...current, groups }));

    try {
      await requestJson("/api/kanji/move", {
        method: "PATCH",
        body: JSON.stringify({
          kanjiId: movingKanji.id,
          toGroupId: targetGroup.id,
          sourceKanjiIds: sourceIds,
          targetKanjiIds: targetIds,
        }),
      });
    } catch {
      await loadData();
    }
  }

  async function reorderVocabulary(
    activeData: Extract<DragData, { type: "vocab" }>,
    overData: Extract<DragData, { type: "vocab" }>,
  ) {
    if (activeData.kanjiItemId !== overData.kanjiItemId) {
      setMessage("Vocabulary rows can only move inside the same kanji block.");
      return;
    }

    let vocabularyIds: string[] = [];
    const groups = data.groups.map((group) => ({
      ...group,
      kanjiItems: group.kanjiItems.map((kanji) => {
        if (kanji.id !== activeData.kanjiItemId) {
          return kanji;
        }

        const oldIndex = kanji.vocabulary.findIndex(
          (row) => row.id === activeData.vocabularyId,
        );
        const newIndex = kanji.vocabulary.findIndex(
          (row) => row.id === overData.vocabularyId,
        );

        if (oldIndex < 0 || newIndex < 0) {
          return kanji;
        }

        const vocabulary = arrayMove(kanji.vocabulary, oldIndex, newIndex).map(
          (row, index) => ({ ...row, sortOrder: index }),
        );
        vocabularyIds = vocabulary.map((row) => row.id);
        return { ...kanji, vocabulary };
      }),
    }));

    if (vocabularyIds.length === 0) {
      return;
    }

    setData((current) => ({ ...current, groups }));

    try {
      await requestJson("/api/vocabulary/reorder", {
        method: "PATCH",
        body: JSON.stringify({
          kanjiItemId: activeData.kanjiItemId,
          vocabularyIds,
        }),
      });
    } catch {
      await loadData();
    }
  }

  function updateAnswer(row: VocabularyRow, value: string) {
    if (mode === "study") {
      return;
    }

    setAnswers((current) => ({
      ...current,
      [answerKey(row.id, mode)]: { value, status: "neutral", revealed: false },
    }));
  }

  async function submitAnswer(row: VocabularyRow) {
    if (mode === "study") {
      return;
    }

    const key = answerKey(row.id, mode);
    const current = answers[key]?.value ?? "";
    const expected = mode === "reading" ? row.reading : row.word;
    const isCorrect = checkAnswer(current, expected);

    setAnswers((answersState) => ({
      ...answersState,
      [key]: {
        value: current,
        status: isCorrect ? "correct" : "wrong",
        revealed: isCorrect,
      },
    }));

    requestJson("/api/attempts", {
      method: "POST",
      body: JSON.stringify({
        vocabularyItemId: row.id,
        mode,
        answer: current,
        isCorrect,
      }),
    }).catch(() => undefined);
  }

  function revealRow(row: VocabularyRow) {
    if (mode === "study") {
      return;
    }

    setAnswers((current) => ({
      ...current,
      [answerKey(row.id, mode)]: {
        value: current[answerKey(row.id, mode)]?.value ?? "",
        status: current[answerKey(row.id, mode)]?.status ?? "neutral",
        revealed: !current[answerKey(row.id, mode)]?.revealed,
      },
    }));
  }

  function resetAnswers(status: "wrong" | "correct" | "all") {
    if (mode === "study") {
      return;
    }

    setAnswers((current) => {
      const next = { ...current };
      const prefix = `${mode}:`;

      for (const [key, state] of Object.entries(current)) {
        if (!key.startsWith(prefix)) {
          continue;
        }

        if (status === "all" || state.status === status) {
          delete next[key];
        }
      }

      return next;
    });
  }

  return (
    <main className="app-shell">
      <section className="app-header" aria-label="App header">
        <div>
          <h1>Kanji Spreadsheet</h1>
          <p>Organize kanji groups, review vocabulary, and test answers in one table.</p>
        </div>
        <div className="header-actions">
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button type="button" size="lg">
                <Plus size={16} />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent className="import-dialog">
              <DialogHeader>
                <DialogTitle className="import-title">Add Kanji JSON</DialogTitle>
                <DialogDescription>
                  Paste a JSON array, review the spreadsheet preview, then import it.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                className="json-input"
                aria-label="Paste JSON here"
                value={rawImport}
                onChange={(event) => setRawImport(event.target.value)}
                spellCheck={false}
              />
              <div className="toolbar">
                <Button
                  type="button"
                  variant="outline"
                  onClick={validateImport}
                  disabled={isBusy}
                >
                  Review
                </Button>
                <Button type="button" variant="secondary" onClick={copyPrompt}>
                  <Clipboard size={15} />
                  Copy AI Prompt
                </Button>
              </div>
              <Feedback message={isImportOpen ? message : ""} errors={validationErrors} />
              {preview ? (
                <ImportPreviewPanel
                  preview={preview}
                  kanjiDecisions={kanjiDecisions}
                  vocabularyDecisions={vocabularyDecisions}
                  onKanjiDecisionChange={(kanji, decision) =>
                    setKanjiDecisions((current) => ({
                      ...current,
                      [kanji]: decision,
                    }))
                  }
                  onVocabularyDecisionChange={(id, decision) =>
                    setVocabularyDecisions((current) => ({
                      ...current,
                      [id]: decision,
                    }))
                  }
                  onImport={commitImport}
                  isBusy={isBusy}
                />
              ) : null}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsImportOpen(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            title="Refresh data"
            onClick={() => loadData()}
          >
            <RefreshCw size={16} />
          </Button>
          <Dialog open={isAnkiDialogOpen} onOpenChange={setIsAnkiDialogOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                title="Anki connection status and setup"
              >
                <Layers size={16} />
                Anki
                <span
                  className={[
                    "anki-status-dot",
                    ankiReady
                      ? "is-ready"
                      : ankiStatus?.reachable
                        ? "is-error"
                        : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              </Button>
            </DialogTrigger>
            <DialogContent className="anki-dialog">
              <DialogHeader>
                <DialogTitle>Anki connection</DialogTitle>
                <DialogDescription>
                  Save each vocabulary row as its own Anki note through AnkiConnect.
                </DialogDescription>
              </DialogHeader>
              <div className="anki-status-grid">
                <div className="anki-status-card">
                  <span className="anki-status-label">Connection</span>
                  <strong>{ankiStatus?.reachable ? "Connected" : "Not connected"}</strong>
                  <p>{ankiStatus?.reachable ? "AnkiConnect is reachable." : "Open Anki and enable AnkiConnect."}</p>
                </div>
                <div className="anki-status-card">
                  <span className="anki-status-label">Deck</span>
                  <strong>{ankiStatus?.deckReady ? ankiStatus.deckName : "Needs setup"}</strong>
                  <p>{ankiStatus?.deckReady ? "Vocabulary notes will be saved here." : "Run setup to create the deck."}</p>
                </div>
                <div className="anki-status-card">
                  <span className="anki-status-label">Saved</span>
                  <strong>
                    {ankiProgress.saved}/{ankiProgress.total}
                  </strong>
                  <p>Saved rows become locked in the Anki column.</p>
                </div>
              </div>
              <div className="anki-summary">
                <span
                  className={[
                    "anki-status-dot",
                    ankiReady
                      ? "is-ready"
                      : ankiStatus?.reachable
                        ? "is-error"
                        : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
                {ankiStatus
                  ? ankiReady
                    ? `Ready: note type "${ankiStatus.modelName}".`
                    : ankiStatus.reachable
                      ? "Anki is reachable, but deck or note type is not ready."
                      : ankiStatus.message || "Cannot reach Anki."
                  : "Checking Anki..."}
              </div>
              <div className="toolbar">
                <Button
                  type="button"
                  onClick={setupAnki}
                  disabled={isAnkiBusy}
                >
                  {isAnkiBusy ? "Setting up…" : "Setup deck & note type"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={syncAnki}
                  disabled={isAnkiBusy || !ankiReady}
                >
                  <RefreshCw size={15} />
                  Sync to AnkiWeb
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={refreshAnkiStatus}
                  disabled={isAnkiBusy}
                >
                  Check again
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setAnkiResetStep("first")}
                  disabled={isAnkiBusy || !ankiStatus?.reachable}
                  title="Delete all notes in the Anki deck and clear saved state in this app"
                >
                  <Trash2 size={15} />
                  Reset saved data
                </Button>
              </div>
              {ankiMessage ? (
                <Feedback message={ankiMessage} errors={[]} />
              ) : null}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAnkiDialogOpen(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog
            open={ankiResetStep === "first"}
            onOpenChange={(open) => setAnkiResetStep(open ? "first" : "none")}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reset Anki saved data?</DialogTitle>
                <DialogDescription>
                  This will delete every note in the configured Anki deck if the deck
                  still exists, then clear all Saved badges in this app.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAnkiResetStep("none")}
                  disabled={isAnkiBusy}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setAnkiResetStep("second")}
                  disabled={isAnkiBusy}
                >
                  Continue
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog
            open={ankiResetStep === "second"}
            onOpenChange={(open) => setAnkiResetStep(open ? "second" : "none")}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Final confirmation</DialogTitle>
                <DialogDescription>
                  This cannot be undone from the app. All cards in the Anki deck
                  {" "}
                  <strong>{ankiStatus?.deckName || "Kanji Learning"}</strong>{" "}
                  will be removed if that deck exists, and every vocabulary row
                  will return to the unsaved state.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAnkiResetStep("none")}
                  disabled={isAnkiBusy}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={resetAnkiSavedData}
                  disabled={isAnkiBusy}
                >
                  {isAnkiBusy ? "Resetting..." : "Reset everything"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>
      {!isImportOpen ? <Feedback message={message} errors={[]} /> : null}

      <section className="controls-band" aria-label="Study controls">
        <div className="mode-control">
          <span>Mode</span>
          {(["study", "reading", "writing"] as StudyMode[]).map((item) => (
            <Button
              variant={mode === item ? "default" : "outline"}
              size="sm"
              type="button"
              key={item}
              onClick={() => setMode(item)}
            >
              {modeLabel(item)}
            </Button>
          ))}
        </div>
        <div className="group-control">
          <span>Groups</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isBusy || data.groups.length === 0}
            onClick={() => changeAllGroupsCollapsed(true)}
          >
            <ChevronsRight size={14} />
            Collapse All
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isBusy || data.groups.length === 0}
            onClick={() => changeAllGroupsCollapsed(false)}
          >
            <ChevronsDown size={14} />
            Expand All
          </Button>
        </div>
        {mode !== "study" ? (
          <div className="reset-control">
            <span>Reset</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => resetAnswers("wrong")}
            >
              Reset Wrong
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => resetAnswers("correct")}
            >
              Reset Correct
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => resetAnswers("all")}
            >
              Reset All
            </Button>
          </div>
        ) : null}
        <div className="column-control">
          <span>Columns</span>
          {COLUMNS.map((column) => (
            <label key={column.key}>
              <input
                type="checkbox"
                checked={data.columnSettings[column.key]}
                onChange={(event) => changeColumn(column.key, event.target.checked)}
              />
              {column.label}
            </label>
          ))}
        </div>
      </section>

      <section className="table-wrap" aria-label="Kanji table">
        <DndContext
          id="kanji-dnd"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortableItems}
            strategy={verticalListSortingStrategy}
          >
            <table className="kanji-table">
              <colgroup>
                {visibleColumns.map((column) => (
                  <col key={column.key} className={columnClass(column.key)} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {visibleColumns.map((column) => (
                    <th
                      key={column.key}
                      className={columnClass(column.key)}
                      title={column.label}
                    >
                      {columnHeader(column.key, column.label)}
                    </th>
                  ))}
                  <th className="col-anki" title="Save to Anki">
                    Anki
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.groups.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length + 1} className="empty-cell">
                      No kanji imported yet.
                    </td>
                  </tr>
                ) : (
                  data.groups.map((group, groupIndex) =>
                    group.isCollapsed ? (
                      <CollapsedGroupRow
                        key={group.id}
                        group={group}
                        groupIndex={groupIndex}
                        visibleColumns={visibleColumns.map((column) => column.key)}
                        onToggle={() => toggleGroup(group)}
                        onMoveItem={moveItem}
                      />
                    ) : (
                      <ExpandedGroupRows
                        key={group.id}
                        group={group}
                        groupIndex={groupIndex}
                        visibleColumns={visibleColumns.map((column) => column.key)}
                        mode={mode}
                        answers={answers}
                        hoveredKanjiId={hoveredKanjiId}
                        hoveredVocabularyId={hoveredVocabularyId}
                        onKanjiHover={setHoveredKanjiId}
                        onVocabularyHover={setHoveredVocabularyId}
                        onToggle={() => toggleGroup(group)}
                        onAnswerChange={updateAnswer}
                        onSubmitAnswer={submitAnswer}
                        onRevealRow={revealRow}
                        onMoveItem={moveItem}
                        onEdit={openEdit}
                        onDelete={setDeleteTarget}
                        onSaveAnki={saveToAnki}
                        ankiReady={ankiReady}
                        savingAnkiIds={savingAnkiIds}
                      />
                    ),
                  )
                )}
              </tbody>
            </table>
          </SortableContext>
        </DndContext>
      </section>
      <EditItemDialog
        target={editTarget}
        draft={editDraft}
        isBusy={isBusy}
        onDraftChange={(patch) =>
          setEditDraft((current) => ({ ...current, ...patch }))
        }
        onSave={saveEdit}
        onClose={() => setEditTarget(null)}
      />
      <DeleteItemDialog
        target={deleteTarget}
        isBusy={isBusy}
        onDelete={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </main>
  );
}

function ExpandedGroupRows({
  group,
  groupIndex,
  visibleColumns,
  mode,
  answers,
  hoveredKanjiId,
  hoveredVocabularyId,
  onKanjiHover,
  onVocabularyHover,
  onToggle,
  onAnswerChange,
  onSubmitAnswer,
  onRevealRow,
  onMoveItem,
  onEdit,
  onDelete,
  onSaveAnki,
  ankiReady,
  savingAnkiIds,
}: {
  group: KanjiGroup;
  groupIndex: number;
  visibleColumns: ColumnKey[];
  mode: StudyMode;
  answers: Record<string, AnswerState>;
  hoveredKanjiId: string | null;
  hoveredVocabularyId: string | null;
  onKanjiHover: (id: string | null) => void;
  onVocabularyHover: (id: string | null) => void;
  onToggle: () => void;
  onAnswerChange: (row: VocabularyRow, value: string) => void;
  onSubmitAnswer: (row: VocabularyRow) => void;
  onRevealRow: (row: VocabularyRow) => void;
  onMoveItem: MoveItemHandler;
  onEdit: EditHandler;
  onDelete: DeleteHandler;
  onSaveAnki: (row: VocabularyRow) => void;
  ankiReady: boolean;
  savingAnkiIds: Set<string>;
}) {
  const rowCount = getGroupRowCount(group);

  if (group.kanjiItems.length === 0) {
    const leadingCells =
      Number(visibleColumns.includes("collapse")) +
      Number(visibleColumns.includes("group"));

    return (
      <tr className="empty-group-row">
        {visibleColumns.includes("collapse") ? (
          <CollapseCell rowSpan={1} isCollapsed={false} onToggle={onToggle} />
        ) : null}
        {visibleColumns.includes("group") ? (
          <GroupNumberCell
            group={group}
            groupIndex={groupIndex}
            rowSpan={1}
            onMoveItem={onMoveItem}
          />
        ) : null}
        <td
          colSpan={Math.max(visibleColumns.length - leadingCells + 1, 1)}
          className="empty-cell"
        >
          Empty group
        </td>
      </tr>
    );
  }

  const renderedRows = group.kanjiItems.flatMap((kanji, kanjiIndex) => {
    const rows = kanji.vocabulary.length > 0 ? kanji.vocabulary : [null];

    return rows.map((row, rowIndex) => ({
      key: row ? row.id : `${kanji.id}-empty`,
      kanji,
      row,
      isFirstGroupRow: kanjiIndex === 0 && rowIndex === 0,
      isFirstKanjiRow: rowIndex === 0,
      kanjiRowSpan: rows.length,
      vocabularyIndex: rowIndex,
      vocabularyCount: rows.length,
    }));
  });

  return (
    <>
      {renderedRows.map(({
        key,
        kanji,
        row,
        isFirstGroupRow,
        isFirstKanjiRow,
        kanjiRowSpan,
        vocabularyIndex,
        vocabularyCount,
      }) => {
        const answerState =
          row && mode !== "study" ? answers[answerKey(row.id, mode)] : undefined;
        const shouldReveal = answerState?.revealed || answerState?.status === "correct";
        const rowClassName = [
          hoveredKanjiId === kanji.id ? "kanji-block-hovered" : "",
          row && hoveredVocabularyId === row.id ? "vocab-row-hovered" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <SortableVocabularyTr
            key={key}
            row={row}
            kanjiItemId={kanji.id}
            groupId={group.id}
            disabled={!row || kanji.vocabulary.length < 2}
            className={rowClassName}
            onMouseEnter={() => row && onVocabularyHover(row.id)}
            onMouseLeave={() => row && onVocabularyHover(null)}
          >
            {isFirstGroupRow && visibleColumns.includes("collapse") ? (
              <CollapseCell
                rowSpan={rowCount}
                isCollapsed={false}
                onToggle={onToggle}
              />
            ) : null}

            {isFirstGroupRow && visibleColumns.includes("group") ? (
              <GroupNumberCell
                group={group}
                groupIndex={groupIndex}
                rowSpan={rowCount}
                onMoveItem={onMoveItem}
              />
            ) : null}

            {isFirstKanjiRow && visibleColumns.includes("kanjiDetails") ? (
              <SortableKanjiCell
                kanji={kanji}
                rowSpan={kanjiRowSpan}
                onHover={onKanjiHover}
                onMoveItem={onMoveItem}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ) : null}

              {visibleColumns.includes("word") ? (
                <SuppressedCell
                  column="word"
                  mode={mode}
                  shouldReveal={shouldReveal}
                >
                  {row ? (
                    <div className="word-cell-content">
                      <MoveButtons
                        label={`vocabulary ${row.word}`}
                        onMove={(direction) =>
                          onMoveItem("vocabulary", row.id, direction)
                        }
                        disableUp={vocabularyIndex === 0}
                        disableDown={vocabularyIndex >= vocabularyCount - 1}
                      />
                      <span>{row.word}</span>
                      <ItemButtons
                        label={`word ${row.word}`}
                        onEdit={() => onEdit({ type: "vocabulary", row })}
                        onDelete={() => onDelete({ type: "vocabulary", row })}
                      />
                    </div>
                  ) : (
                    ""
                  )}
                </SuppressedCell>
              ) : null}
              {visibleColumns.includes("wordHanViet") ? (
                <SuppressedCell
                  column="wordHanViet"
                  mode={mode}
                  shouldReveal={shouldReveal}
                >
                  {row?.hanViet || ""}
                </SuppressedCell>
              ) : null}
              {visibleColumns.includes("type") ? (
                <SuppressedCell
                  column="type"
                  mode={mode}
                  shouldReveal={shouldReveal}
                >
                  {row?.type ? (
                    <span className={vocabTypeClass(row.type)}>{row.type}</span>
                  ) : (
                    ""
                  )}
                </SuppressedCell>
              ) : null}
              {visibleColumns.includes("reading") ? (
                <SuppressedCell
                  column="reading"
                  mode={mode}
                  shouldReveal={shouldReveal}
                >
                  {row?.reading || ""}
                </SuppressedCell>
              ) : null}
              {visibleColumns.includes("meaning") ? (
                <SuppressedCell
                  column="meaning"
                  mode={mode}
                  shouldReveal={shouldReveal}
                >
                  {row?.meaning || ""}
                </SuppressedCell>
              ) : null}
              {visibleColumns.includes("example") ? (
                <SuppressedCell
                  column="example"
                  mode={mode}
                  shouldReveal={shouldReveal}
                >
                  {row ? (
                    <ExampleText
                      tokens={row.exampleJapanese}
                      vietnamese={row.exampleVietnamese}
                    />
                  ) : null}
                </SuppressedCell>
              ) : null}
              {visibleColumns.includes("answer") ? (
                <td className={answerCellClass(answerState)}>
                  {row && mode !== "study" ? (
                    <div className="answer-box">
                      <input
                        aria-label={`Answer for ${row.word || row.meaning}`}
                        value={answerState?.value ?? ""}
                        onChange={(event) => onAnswerChange(row, event.target.value)}
                        onPointerDown={(event) => event.stopPropagation()}
                        onKeyDown={(event) => {
                          event.stopPropagation();
                          if (event.key === "Enter") {
                            event.preventDefault();
                            onSubmitAnswer(row);
                          }
                        }}
                      />
                      {answerState?.status === "wrong" ? (
                        <X className="status-wrong" size={16} />
                      ) : null}
                      {answerState?.status === "correct" ? (
                        <Check className="status-correct" size={16} />
                      ) : null}
                    </div>
                  ) : null}
                </td>
              ) : null}
              {visibleColumns.includes("reveal") ? (
                <td className="col-reveal reveal-cell">
                  {row && mode !== "study" ? (
                    <Button
                      className={[
                        "reveal-button",
                        answerState?.revealed ? "is-active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title={answerState?.revealed ? "Hide row" : "Reveal row"}
                      onClick={() => onRevealRow(row)}
                    >
                      <Eye size={14} />
                    </Button>
                  ) : null}
                </td>
              ) : null}
              <td className="col-anki anki-cell">
                {row ? (
                  <AnkiCell
                    row={row}
                    ready={ankiReady}
                    saving={savingAnkiIds.has(row.id)}
                    onSave={() => onSaveAnki(row)}
                  />
                ) : null}
              </td>
          </SortableVocabularyTr>
        );
      })}
    </>
  );
}

function CollapsedGroupRow({
  group,
  groupIndex,
  visibleColumns,
  onToggle,
  onMoveItem,
}: {
  group: KanjiGroup;
  groupIndex: number;
  visibleColumns: ColumnKey[];
  onToggle: () => void;
  onMoveItem: MoveItemHandler;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: groupDragId(group.id),
    data: { type: "group", groupId: group.id } satisfies DragData,
  });
  const leadingCells =
    Number(visibleColumns.includes("collapse")) +
    Number(visibleColumns.includes("group"));
  const summaryColSpan = Math.max(visibleColumns.length - leadingCells + 1, 1);

  return (
    <tr
      ref={setNodeRef}
      className={isDragging ? "dragging collapsed-row" : "collapsed-row"}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {visibleColumns.includes("collapse") ? (
        <td className="col-collapse control-cell">
          <Button
            className="cell-icon-button"
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Expand group"
            onClick={onToggle}
          >
            <ChevronRight size={15} />
          </Button>
        </td>
      ) : null}
      {visibleColumns.includes("group") ? (
        <td
          className="col-group group-number-cell"
          title="Drag group"
          {...attributes}
          {...listeners}
        >
          <div className="group-number-stack">
            <MoveButtons
              label={`group ${groupIndex + 1}`}
              onMove={(direction) => onMoveItem("group", group.id, direction)}
            />
            <strong>{groupIndex + 1}</strong>
          </div>
        </td>
      ) : null}
      <td colSpan={summaryColSpan} className="collapsed-summary-cell">
        <div className="collapsed-content">
          <strong>{groupIndex + 1}</strong>
          <span>{group.kanjiItems.map((item) => item.kanji).join(", ")}</span>
        </div>
      </td>
    </tr>
  );
}

function AnkiCell({
  row,
  ready,
  saving,
  onSave,
}: {
  row: VocabularyRow;
  ready: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  if (row.ankiNoteId) {
    return (
      <span
        className="anki-saved-badge"
        title={`Saved to Anki (note ${row.ankiNoteId}).`}
        aria-disabled="true"
      >
        <Check size={14} />
        Saved
      </span>
    );
  }

  return (
    <Button
      className="anki-save-button"
      type="button"
      variant="outline"
      size="sm"
      title={ready ? "Save this word to Anki" : "Anki is not ready. Open Anki setup first."}
      onClick={onSave}
      disabled={!ready || saving}
    >
      {saving ? "Saving…" : "Save to Anki"}
    </Button>
  );
}

function CollapseCell({
  rowSpan,
  isCollapsed,
  onToggle,
}: {
  rowSpan: number;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <td rowSpan={rowSpan} className="col-collapse control-cell">
      <Button
        className="cell-icon-button"
        type="button"
        variant="ghost"
        size="icon-sm"
        title={isCollapsed ? "Expand group" : "Collapse group"}
        onClick={onToggle}
      >
        {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
      </Button>
    </td>
  );
}

function GroupNumberCell({
  group,
  groupIndex,
  rowSpan,
  onMoveItem,
}: {
  group: KanjiGroup;
  groupIndex: number;
  rowSpan: number;
  onMoveItem: MoveItemHandler;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: groupDragId(group.id),
    data: { type: "group", groupId: group.id } satisfies DragData,
  });

  return (
    <td
      ref={setNodeRef}
      rowSpan={rowSpan}
      className={
        isDragging
          ? "col-group group-number-cell dragging"
          : "col-group group-number-cell"
      }
      style={{ transform: CSS.Transform.toString(transform), transition }}
      title="Drag group"
      {...attributes}
      {...listeners}
    >
      <div className="group-number-stack">
        <MoveButtons
          label={`group ${groupIndex + 1}`}
          onMove={(direction) => onMoveItem("group", group.id, direction)}
        />
        <strong>{groupIndex + 1}</strong>
      </div>
    </td>
  );
}

function SortableKanjiCell({
  kanji,
  rowSpan,
  onHover,
  onMoveItem,
  onEdit,
  onDelete,
}: {
  kanji: KanjiBlock;
  rowSpan: number;
  onHover: (id: string | null) => void;
  onMoveItem: MoveItemHandler;
  onEdit: EditHandler;
  onDelete: DeleteHandler;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: kanjiDragId(kanji.id),
    data: { type: "kanji", kanjiId: kanji.id, groupId: kanji.groupId } satisfies DragData,
  });

  return (
    <td
      ref={setNodeRef}
      rowSpan={rowSpan}
      className={
        isDragging
          ? "col-kanjiDetails kanji-detail-cell dragging"
          : "col-kanjiDetails kanji-detail-cell"
      }
      style={{ transform: CSS.Transform.toString(transform), transition }}
      title="Drag kanji block"
      onMouseEnter={() => onHover(kanji.id)}
      onMouseLeave={() => onHover(null)}
      {...attributes}
      {...listeners}
    >
      <div className="kanji-detail-card">
        <MoveButtons
          className="kanji-move-controls"
          label={`kanji ${kanji.kanji}`}
          onMove={(direction) => onMoveItem("kanji", kanji.id, direction)}
        />
        <ItemButtons
          className="kanji-item-actions"
          label={`kanji ${kanji.kanji}`}
          onEdit={() => onEdit({ type: "kanji", item: kanji })}
          onDelete={() => onDelete({ type: "kanji", item: kanji })}
        />
        <div className="kanji-detail-topline">
          <span className="han-viet-heading">{kanji.hanViet || "No Han Viet"}</span>
        </div>
        <div className="kanji-glyph">{kanji.kanji}</div>
        <div className="kanji-detail-meaning">{kanji.meaning || "No meaning"}</div>
        <div className="reading-stack">
          <span>
            <strong>Kun</strong>
            {kanji.kun.length ? kanji.kun.join(", ") : "-"}
          </span>
          <span>
            <strong>On</strong>
            {kanji.on.length ? kanji.on.join(", ") : "-"}
          </span>
        </div>
      </div>
    </td>
  );
}

function SortableVocabularyTr({
  row,
  kanjiItemId,
  groupId,
  disabled,
  className,
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  row: VocabularyRow | null;
  kanjiItemId: string;
  groupId: string;
  disabled: boolean;
  className?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: React.ReactNode;
}) {
  const sortableId = row ? vocabularyDragId(row.id) : `empty:${kanjiItemId}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: sortableId,
      data: row
        ? ({
            type: "vocab",
            vocabularyId: row.id,
            kanjiItemId,
            groupId,
          } satisfies DragData)
        : undefined,
      disabled,
    });

  return (
    <tr
      ref={setNodeRef}
      className={[className, row ? "vocab-draggable-row" : "", isDragging ? "dragging" : ""]
        .filter(Boolean)
        .join(" ")}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      title={row && !disabled ? "Drag vocabulary row" : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      {...(!disabled ? attributes : {})}
      {...(!disabled ? listeners : {})}
    >
      {children}
    </tr>
  );
}

function MoveButtons({
  label,
  onMove,
  disableUp = false,
  disableDown = false,
  className = "",
}: {
  label: string;
  onMove: (direction: MoveDirection) => void;
  disableUp?: boolean;
  disableDown?: boolean;
  className?: string;
}) {
  return (
    <div
      className={["move-controls", className].filter(Boolean).join(" ")}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="move-button"
        title={`Move ${label} up`}
        disabled={disableUp}
        onClick={() => onMove("up")}
      >
        <ArrowUp size={13} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="move-button"
        title={`Move ${label} down`}
        disabled={disableDown}
        onClick={() => onMove("down")}
      >
        <ArrowDown size={13} />
      </Button>
    </div>
  );
}

function ItemButtons({
  label,
  onEdit,
  onDelete,
  className = "",
}: {
  label: string;
  onEdit: () => void;
  onDelete: () => void;
  className?: string;
}) {
  return (
    <div
      className={["item-controls", className].filter(Boolean).join(" ")}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="item-button"
        title={`Edit ${label}`}
        onClick={onEdit}
      >
        <Pencil size={13} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="item-button item-button-danger"
        title={`Delete ${label}`}
        onClick={onDelete}
      >
        <Trash2 size={13} />
      </Button>
    </div>
  );
}

function EditItemDialog({
  target,
  draft,
  isBusy,
  onDraftChange,
  onSave,
  onClose,
}: {
  target: EditTarget | null;
  draft: EditDraft;
  isBusy: boolean;
  onDraftChange: (patch: Partial<EditDraft>) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const isKanji = target?.type === "kanji";

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="item-dialog">
        <DialogHeader>
          <DialogTitle>{isKanji ? "Edit Kanji" : "Edit Word"}</DialogTitle>
          <DialogDescription>
            {isKanji
              ? "Save updates to this Kanji Details level."
              : "Save updates to word, Han Viet, type, reading, and meaning. Example is unchanged."}
          </DialogDescription>
        </DialogHeader>

        {isKanji ? (
          <div className="edit-form-grid">
            <label>
              Kanji
              <input
                aria-label="Edit kanji"
                value={draft.kanji}
                onChange={(event) => onDraftChange({ kanji: event.target.value })}
              />
            </label>
            <label>
              Han Viet
              <input
                aria-label="Edit Han Viet"
                value={draft.hanViet}
                onChange={(event) =>
                  onDraftChange({ hanViet: event.target.value })
                }
              />
            </label>
            <label>
              Meaning
              <input
                aria-label="Edit kanji meaning"
                value={draft.meaning}
                onChange={(event) =>
                  onDraftChange({ meaning: event.target.value })
                }
              />
            </label>
            <label>
              Kun readings
              <input
                aria-label="Edit Kun readings"
                value={draft.kunText}
                onChange={(event) =>
                  onDraftChange({ kunText: event.target.value })
                }
                placeholder="つき, ひ"
              />
            </label>
            <label>
              On readings
              <input
                aria-label="Edit On readings"
                value={draft.onText}
                onChange={(event) => onDraftChange({ onText: event.target.value })}
                placeholder="ゲツ, ガツ"
              />
            </label>
          </div>
        ) : (
          <div className="edit-form-grid">
            <label>
              Word
              <input
                aria-label="Edit word"
                value={draft.word}
                onChange={(event) => onDraftChange({ word: event.target.value })}
              />
            </label>
            <label>
              Han Viet
              <input
                aria-label="Edit word Han Viet"
                value={draft.wordHanViet}
                onChange={(event) =>
                  onDraftChange({ wordHanViet: event.target.value })
                }
              />
            </label>
            <label>
              Type
              <Select
                value={draft.type}
                onValueChange={(value) =>
                  onDraftChange({ type: value as VocabularyType })
                }
              >
                <SelectTrigger aria-label="Edit word type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VOCABULARY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label>
              Reading
              <input
                aria-label="Edit reading"
                value={draft.reading}
                onChange={(event) =>
                  onDraftChange({ reading: event.target.value })
                }
              />
            </label>
            <label>
              Meaning
              <input
                aria-label="Edit word meaning"
                value={draft.meaning}
                onChange={(event) =>
                  onDraftChange({ meaning: event.target.value })
                }
              />
            </label>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={isBusy}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteItemDialog({
  target,
  isBusy,
  onDelete,
  onClose,
}: {
  target: DeleteTarget | null;
  isBusy: boolean;
  onDelete: () => void;
  onClose: () => void;
}) {
  const level = target?.type === "kanji" ? "Kanji Details" : "Word";
  const item =
    target?.type === "kanji"
      ? target.item.kanji
      : target?.type === "vocabulary"
        ? target.row.word
        : "";

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="item-dialog">
        <DialogHeader>
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogDescription>
            This action cannot be undone. Check the level and item before deleting.
          </DialogDescription>
        </DialogHeader>
        <div className="delete-confirm-box">
          <p>
            <strong>Level:</strong> {level}
          </p>
          <p>
            <strong>Item:</strong> {item}
          </p>
          {target?.type === "kanji" ? (
            <p className="delete-warning">
              Deleting this kanji also deletes all words inside it.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onDelete}
            disabled={isBusy}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SuppressedCell({
  column,
  mode,
  shouldReveal,
  children,
}: {
  column: ColumnKey;
  mode: StudyMode;
  shouldReveal: boolean | undefined;
  children: React.ReactNode;
}) {
  const suppressed = !shouldReveal && isSuppressedByMode(column, mode);

  return (
    <td className={cellClass(column, suppressed ? "hidden-test-cell" : "")}>
      {suppressed ? "" : children}
    </td>
  );
}

function ImportPreviewPanel({
  preview,
  kanjiDecisions,
  vocabularyDecisions,
  onKanjiDecisionChange,
  onVocabularyDecisionChange,
  onImport,
  isBusy,
}: {
  preview: ImportPreview;
  kanjiDecisions: Record<string, KanjiDuplicateDecision>;
  vocabularyDecisions: Record<string, VocabularyDuplicateDecision>;
  onKanjiDecisionChange: (kanji: string, decision: KanjiDuplicateDecision) => void;
  onVocabularyDecisionChange: (
    id: string,
    decision: VocabularyDuplicateDecision,
  ) => void;
  onImport: () => void;
  isBusy: boolean;
}) {
  return (
    <div className="preview-panel">
      <div className="preview-summary">
        <Badge variant="secondary">New kanji: {preview.summary.newKanji}</Badge>
        <Badge variant="secondary">
          Duplicate kanji: {preview.summary.duplicateKanji}
        </Badge>
        <Badge variant="secondary">
          New vocabulary: {preview.summary.newVocabulary}
        </Badge>
        <Badge variant="secondary">
          Duplicate vocabulary: {preview.summary.duplicateVocabulary}
        </Badge>
      </div>
      <JsonReviewTable items={preview.imported} />
      {preview.newKanji.length > 0 ? (
        <div className="preview-block">
          <h2>New Kanji</h2>
          <p>{preview.newKanji.map((item) => item.kanji).join(", ")}</p>
        </div>
      ) : null}
      {preview.duplicateKanji.map((item) => (
        <DuplicateKanjiBlock
          key={item.kanji}
          item={item}
          decision={kanjiDecisions[item.kanji] ?? "keep_old"}
          vocabularyDecisions={vocabularyDecisions}
          onKanjiDecisionChange={onKanjiDecisionChange}
          onVocabularyDecisionChange={onVocabularyDecisionChange}
        />
      ))}
      <div className="import-action-row">
        <Button type="button" size="lg" onClick={onImport} disabled={isBusy}>
          Import
        </Button>
      </div>
    </div>
  );
}

function JsonReviewTable({ items }: { items: KanjiImportItem[] }) {
  return (
    <div className="review-table-wrap">
      <table className="kanji-table review-table">
        <colgroup>
          {(
            [
              "group",
              "kanjiDetails",
              "word",
              "wordHanViet",
              "type",
              "reading",
              "meaning",
              "example",
            ] as ColumnKey[]
          ).map((column) => (
            <col key={column} className={columnClass(column)} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="col-group">#</th>
            <th className="col-kanjiDetails">Kanji Details</th>
            <th className="col-word">Word</th>
            <th className="col-wordHanViet">Han Viet</th>
            <th className="col-type">Type</th>
            <th className="col-reading">Reading</th>
            <th className="col-meaning">Meaning</th>
            <th className="col-example">Example</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, groupIndex) => {
            const rows = item.vocabulary.length ? item.vocabulary : [null];

            return rows.map((row, rowIndex) => (
              <tr key={`${item.kanji}-${rowIndex}`}>
                {rowIndex === 0 ? (
                  <>
                    <td
                      rowSpan={rows.length}
                      className="merged-cell review-group-cell col-group"
                    >
                      {groupIndex + 1}
                    </td>
                    <td rowSpan={rows.length} className="kanji-detail-cell col-kanjiDetails">
                      <div className="kanji-detail-card">
                        <div className="kanji-detail-topline">
                          <span className="han-viet-heading">
                            {item.han_viet || "No Han Viet"}
                          </span>
                        </div>
                        <div className="kanji-glyph">{item.kanji}</div>
                        <div className="kanji-detail-meaning">
                          {item.meaning || "No meaning"}
                        </div>
                        <div className="reading-stack">
                          <span>
                            <strong>Kun</strong>
                            {item.kun.length ? item.kun.join(", ") : "-"}
                          </span>
                          <span>
                            <strong>On</strong>
                            {item.on.length ? item.on.join(", ") : "-"}
                          </span>
                        </div>
                      </div>
                    </td>
                  </>
                ) : null}
                <td className="col-word">{row?.word ?? ""}</td>
                <td className="col-wordHanViet">{row?.han_viet ?? ""}</td>
                <td className="col-type">
                  {row?.type ? (
                    <span className={vocabTypeClass(row.type)}>{row.type}</span>
                  ) : (
                    ""
                  )}
                </td>
                <td className="col-reading">{row?.reading ?? ""}</td>
                <td className="col-meaning">{row?.meaning ?? ""}</td>
                <td className="col-example">
                  {row ? (
                    <ExampleText
                      tokens={row.example.japanese}
                      vietnamese={row.example.vietnamese}
                    />
                  ) : null}
                </td>
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}

function DuplicateKanjiBlock({
  item,
  decision,
  vocabularyDecisions,
  onKanjiDecisionChange,
  onVocabularyDecisionChange,
}: {
  item: DuplicateKanjiPreview;
  decision: KanjiDuplicateDecision;
  vocabularyDecisions: Record<string, VocabularyDuplicateDecision>;
  onKanjiDecisionChange: (kanji: string, decision: KanjiDuplicateDecision) => void;
  onVocabularyDecisionChange: (
    id: string,
    decision: VocabularyDuplicateDecision,
  ) => void;
}) {
  return (
    <div className="preview-block duplicate-outer">
      <div className="preview-title-row">
        <h2>Duplicate Kanji: {item.kanji}</h2>
        <Select
          value={decision}
          onValueChange={(value) =>
            onKanjiDecisionChange(
              item.kanji,
              value as KanjiDuplicateDecision,
            )
          }
        >
          <SelectTrigger className="decision-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="keep_old">Keep Old</SelectItem>
            <SelectItem value="use_new">Use New</SelectItem>
            <SelectItem value="merge">Merge</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DiffGrid
        rows={[
          ["Han Viet", item.existing.hanViet, item.incoming.han_viet],
          ["Kanji Meaning", item.existing.meaning, item.incoming.meaning],
          ["Kun", item.existing.kun.join(", "), item.incoming.kun.join(", ")],
          ["On", item.existing.on.join(", "), item.incoming.on.join(", ")],
        ]}
        decision={decision}
      />
      {item.newVocabulary.length > 0 ? (
        <p className="preview-note">
          New vocabulary will be added:{" "}
          {item.newVocabulary.map((row) => row.word).join(", ")}
        </p>
      ) : null}
      {item.duplicateVocabulary.map((duplicate) => (
        <DuplicateVocabularyBlock
          key={duplicate.id}
          item={duplicate}
          decision={vocabularyDecisions[duplicate.id] ?? "keep_old"}
          onChange={onVocabularyDecisionChange}
        />
      ))}
    </div>
  );
}

function DuplicateVocabularyBlock({
  item,
  decision,
  onChange,
}: {
  item: DuplicateVocabularyPreview;
  decision: VocabularyDuplicateDecision;
  onChange: (id: string, decision: VocabularyDuplicateDecision) => void;
}) {
  return (
    <div className="vocab-duplicate duplicate-inner">
      <div className="preview-title-row">
        <h3>Duplicate Vocabulary: {item.word}</h3>
        <Select
          value={decision}
          onValueChange={(value) =>
            onChange(item.id, value as VocabularyDuplicateDecision)
          }
        >
          <SelectTrigger className="decision-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="keep_old">Keep Old</SelectItem>
            <SelectItem value="use_new">Use New</SelectItem>
            <SelectItem value="keep_both">Keep Both</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DiffGrid
        rows={[
          ["Word", item.existing.word, item.incoming.word],
          ["Han Viet", item.existing.hanViet, item.incoming.han_viet],
          ["Type", item.existing.type, item.incoming.type],
          ["Reading", item.existing.reading, item.incoming.reading],
          ["Meaning", item.existing.meaning, item.incoming.meaning],
          [
            "Example Japanese",
            item.existing.exampleJapanese.map((token) => token.text).join(""),
            item.incoming.example.japanese.map((token) => token.text).join(""),
          ],
          [
            "Example Vietnamese",
            item.existing.exampleVietnamese,
            item.incoming.example.vietnamese,
          ],
        ]}
        decision={decision}
      />
    </div>
  );
}

type DuplicateDecision = KanjiDuplicateDecision | VocabularyDuplicateDecision;

function DiffGrid({
  rows,
  decision,
}: {
  rows: Array<[string, string, string]>;
  decision: DuplicateDecision;
}) {
  return (
    <table className="diff-grid">
      <thead>
        <tr>
          <th>Field</th>
          <th>Old</th>
          <th>New</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, oldValue, newValue]) => (
          <tr key={label} className={oldValue === newValue ? "" : "diff-row"}>
            <td>{label}</td>
            <td className={decisionCellClass(decision, "old")}>{oldValue}</td>
            <td className={decisionCellClass(decision, "new")}>{newValue}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Feedback({
  message,
  errors,
}: {
  message: string;
  errors: Array<{ path: string; message: string }>;
}) {
  if (!message && errors.length === 0) {
    return null;
  }

  return (
    <div className={errors.length > 0 ? "feedback feedback-error" : "feedback"}>
      {message ? <p>{message}</p> : null}
      {errors.length > 0 ? (
        <ul>
          {errors.map((error) => (
            <li key={`${error.path}-${error.message}`}>
              <strong>{error.path}</strong>: {error.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function isColumnVisible(
  key: ColumnKey,
  settings: Record<ColumnKey, boolean>,
  mode: StudyMode,
) {
  if (mode === "reading" && (key === "word" || key === "answer")) {
    return true;
  }

  if (mode === "writing" && (key === "meaning" || key === "answer")) {
    return true;
  }

  return settings[key];
}

function isSuppressedByMode(column: ColumnKey, mode: StudyMode) {
  if (mode === "reading") {
    return column === "reading" || column === "meaning" || column === "example";
  }

  if (mode === "writing") {
    return column === "word" || column === "reading" || column === "example";
  }

  return false;
}

function answerCellClass(answerState: AnswerState | undefined) {
  if (answerState?.status === "correct") {
    return "col-answer answer-cell answer-correct";
  }

  if (answerState?.status === "wrong") {
    return "col-answer answer-cell answer-wrong";
  }

  return "col-answer answer-cell";
}

function columnClass(key: ColumnKey) {
  return `col-${key}`;
}

function columnHeader(key: ColumnKey, label: string) {
  if (key === "collapse") {
    return "";
  }

  if (key === "group") {
    return "#";
  }

  if (key === "reveal") {
    return "";
  }

  return label;
}

function cellClass(key: ColumnKey, extraClassName = "") {
  return [columnClass(key), extraClassName].filter(Boolean).join(" ");
}

function withAllGroupsCollapsed(data: TableData, isCollapsed: boolean): TableData {
  return {
    ...data,
    groups: data.groups.map((group) => ({
      ...group,
      isCollapsed,
    })),
  };
}

function vocabTypeClass(type: VocabularyType) {
  const variant = {
    "danh từ": "vocab-type-noun",
    "tính từ i": "vocab-type-i-adjective",
    "tính từ na": "vocab-type-na-adjective",
    "tha động từ": "vocab-type-transitive-verb",
    "tự động từ": "vocab-type-intransitive-verb",
  } satisfies Record<VocabularyType, string>;

  return ["vocab-type-pill", variant[type]].join(" ");
}

function decisionCellClass(decision: DuplicateDecision, side: "old" | "new") {
  if (decision === "merge") {
    return "decision-merge";
  }

  if (decision === "keep_both") {
    return "decision-kept";
  }

  if (decision === "keep_old") {
    return side === "old" ? "decision-kept" : "decision-discarded";
  }

  return side === "new" ? "decision-kept" : "decision-discarded";
}

function answerKey(vocabularyId: string, mode: TestMode) {
  return `${mode}:${vocabularyId}`;
}

function loadStoredAnswers(): Record<string, AnswerState> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const stored = window.localStorage.getItem(ANSWER_STORAGE_KEY);
    return stored ? sanitizeAnswerState(JSON.parse(stored)) : {};
  } catch {
    return {};
  }
}

function sanitizeAnswerState(value: unknown): Record<string, AnswerState> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, state]) => {
      if (
        typeof state !== "object" ||
        state === null ||
        !key.match(/^(reading|writing):/)
      ) {
        return [];
      }

      const candidate = state as Record<string, unknown>;
      const status = candidate.status;

      if (status !== "neutral" && status !== "correct" && status !== "wrong") {
        return [];
      }

      return [
        [
          key,
          {
            value: typeof candidate.value === "string" ? candidate.value : "",
            status,
            revealed: candidate.revealed === true,
          },
        ],
      ];
    }),
  );
}

function getGroupRowCount(group: KanjiGroup) {
  return group.kanjiItems.reduce(
    (total, item) => total + Math.max(item.vocabulary.length, 1),
    0,
  );
}

function getGroupId(data: DragData) {
  return data.groupId;
}

function insertAt<T>(items: T[], index: number, item: T) {
  const next = [...items];
  const safeIndex = index < 0 ? next.length : Math.min(index, next.length);
  next.splice(safeIndex, 0, item);
  return next;
}

function splitList(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function modeLabel(mode: StudyMode) {
  if (mode === "reading") {
    return "Reading Test";
  }

  if (mode === "writing") {
    return "Writing Test";
  }

  return "Study";
}

function groupDragId(id: string) {
  return `group:${id}`;
}

function kanjiDragId(id: string) {
  return `kanji:${id}`;
}

function vocabularyDragId(id: string) {
  return `vocab:${id}`;
}

type ApiError = Error & {
  errors?: Array<{ path: string; message: string }>;
};

async function requestJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const text = await response.text();
  let data: unknown = {};

  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const payload = data as { message?: string; errors?: ApiError["errors"] };
    const error = new Error(payload.message || "Request failed") as ApiError;
    error.errors = payload.errors;
    throw error;
  }

  return data as T;
}

function replaceVocabularyAnkiId(
  data: TableData,
  vocabularyId: string,
  ankiNoteId: number | null,
): TableData {
  return {
    ...data,
    groups: data.groups.map((group) => ({
      ...group,
      kanjiItems: group.kanjiItems.map((kanji) => ({
        ...kanji,
        vocabulary: kanji.vocabulary.map((row) =>
          row.id === vocabularyId ? { ...row, ankiNoteId } : row,
        ),
      })),
    })),
  };
}

function clearAllVocabularyAnkiIds(data: TableData): TableData {
  return {
    ...data,
    groups: data.groups.map((group) => ({
      ...group,
      kanjiItems: group.kanjiItems.map((kanji) => ({
        ...kanji,
        vocabulary: kanji.vocabulary.map((row) => ({
          ...row,
          ankiNoteId: null,
        })),
      })),
    })),
  };
}

async function fetchAnkiStatus(): Promise<AnkiStatus> {
  try {
    return await requestJson<AnkiStatus & { ok: boolean }>("/api/anki/status");
  } catch (error) {
    return {
      reachable: false,
      deckReady: false,
      modelReady: false,
      message: error instanceof Error ? error.message : "Anki check failed",
    };
  }
}
