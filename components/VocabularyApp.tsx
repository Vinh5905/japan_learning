"use client";

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
  Save,
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
import { ExampleText } from "@/components/ExampleText";
import { VOCABULARY_AI_PROMPT } from "@/lib/constants";
import { checkAnswer } from "@/lib/study";
import {
  VOCABULARY_TYPES,
  type MoveDirection,
  type StandaloneVocabularyData,
  type StandaloneVocabularyGroup,
  type StandaloneVocabularyImportPreview,
  type StandaloneVocabularyMoveTargetType,
  type StandaloneVocabularyRow,
  type StudyMode,
  type VocabularyType,
} from "@/lib/types";

type AnswerState = {
  value: string;
  status: "neutral" | "correct" | "wrong";
  revealed: boolean;
};

type TestMode = Extract<StudyMode, "reading" | "writing">;
type AnkiResetStep = "none" | "first" | "second";

type AnkiStatus = {
  reachable: boolean;
  deckReady: boolean;
  modelReady: boolean;
  message?: string;
  deckName?: string;
  modelName?: string;
};

type EditDraft = {
  word: string;
  hanViet: string;
  type: VocabularyType;
  reading: string;
  meaning: string;
};

const ANSWER_STORAGE_KEY = "standalone-vocabulary-answer-state:v1";

const EMPTY_EDIT_DRAFT: EditDraft = {
  word: "",
  hanViet: "",
  type: "danh từ",
  reading: "",
  meaning: "",
};

export function VocabularyApp({
  initialData,
}: {
  initialData: StandaloneVocabularyData;
}) {
  const [data, setData] = useState<StandaloneVocabularyData>(() =>
    withAllVocabGroupsCollapsed(initialData, true),
  );
  const [mode, setMode] = useState<StudyMode>("study");
  const [rawImport, setRawImport] = useState("");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [preview, setPreview] =
    useState<StandaloneVocabularyImportPreview | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    Array<{ path: string; message: string }>
  >([]);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>(
    loadStoredAnswers,
  );
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [editTarget, setEditTarget] = useState<StandaloneVocabularyRow | null>(
    null,
  );
  const [editDraft, setEditDraft] = useState<EditDraft>(EMPTY_EDIT_DRAFT);
  const [deleteTarget, setDeleteTarget] =
    useState<StandaloneVocabularyRow | null>(null);
  const [ankiStatus, setAnkiStatus] = useState<AnkiStatus | null>(null);
  const [isAnkiDialogOpen, setIsAnkiDialogOpen] = useState(false);
  const [ankiResetStep, setAnkiResetStep] = useState<AnkiResetStep>("none");
  const [isAnkiBusy, setIsAnkiBusy] = useState(false);
  const [ankiMessage, setAnkiMessage] = useState("");
  const [savingAnkiIds, setSavingAnkiIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    const next = await requestJson<StandaloneVocabularyData>("/api/vocab/data");
    setData(next);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(ANSWER_STORAGE_KEY, JSON.stringify(answers));
  }, [answers]);

  const refreshAnkiStatus = useCallback(async () => {
    setAnkiStatus(await fetchVocabularyAnkiStatus());
  }, []);

  useEffect(() => {
    let active = true;
    fetchVocabularyAnkiStatus().then((status) => {
      if (active) {
        setAnkiStatus(status);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const ankiReady = Boolean(
    ankiStatus?.reachable && ankiStatus?.deckReady && ankiStatus?.modelReady,
  );
  const ankiProgress = useMemo(() => {
    const rows = data.groups.flatMap((group) => group.vocabulary);
    return {
      total: rows.length,
      saved: rows.filter((row) => row.ankiNoteId).length,
    };
  }, [data.groups]);

  async function validateImport() {
    setIsBusy(true);
    setMessage("");
    setValidationErrors([]);

    try {
      const response = await requestJson<{
        ok: true;
        preview: StandaloneVocabularyImportPreview;
      }>("/api/vocab/import/validate", {
        method: "POST",
        body: JSON.stringify({ raw: rawImport }),
      });
      setPreview(response.preview);
      setMessage("JSON is valid. Review the vocabulary group before importing.");
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
      const response = await requestJson<{
        ok: true;
        data: StandaloneVocabularyData;
      }>("/api/vocab/import/commit", {
        method: "POST",
        body: JSON.stringify({ raw: rawImport }),
      });
      setData(response.data);
      setPreview(null);
      setValidationErrors([]);
      setIsImportOpen(false);
      setRawImport("");
      setMessage("Vocabulary import completed.");
    } catch (error) {
      const apiError = error as ApiError;
      setValidationErrors(apiError.errors ?? []);
      setMessage(apiError.message || "Import failed");
    } finally {
      setIsBusy(false);
    }
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(VOCABULARY_AI_PROMPT);
    setMessage("Vocabulary AI prompt copied.");
  }

  async function toggleGroup(group: StandaloneVocabularyGroup) {
    const isCollapsed = !group.isCollapsed;
    setData((current) => ({
      ...current,
      groups: current.groups.map((item) =>
        item.id === group.id ? { ...item, isCollapsed } : item,
      ),
    }));

    try {
      await requestJson("/api/vocab/groups/collapse", {
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
    setData((current) => withAllVocabGroupsCollapsed(current, isCollapsed));

    try {
      const response = await requestJson<{
        ok: true;
        data: StandaloneVocabularyData;
      }>("/api/vocab/groups/collapse-all", {
        method: "PATCH",
        body: JSON.stringify({ isCollapsed }),
      });
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

  function startRenameGroup(group: StandaloneVocabularyGroup) {
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
  }

  async function saveGroupName(groupId: string) {
    setIsBusy(true);
    setMessage("");

    try {
      const response = await requestJson<{
        ok: true;
        data: StandaloneVocabularyData;
      }>("/api/vocab/groups/rename", {
        method: "PATCH",
        body: JSON.stringify({ groupId, name: editingGroupName }),
      });
      setData(response.data);
      setEditingGroupId(null);
      setMessage("Vocabulary group renamed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to rename group");
    } finally {
      setIsBusy(false);
    }
  }

  async function moveItem(
    type: StandaloneVocabularyMoveTargetType,
    id: string,
    direction: MoveDirection,
  ) {
    try {
      const response = await requestJson<{
        ok: true;
        data: StandaloneVocabularyData;
      }>("/api/vocab/items/move-step", {
        method: "PATCH",
        body: JSON.stringify({ type, id, direction }),
      });
      setData(response.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to move item");
      await loadData();
    }
  }

  function openEdit(row: StandaloneVocabularyRow) {
    setEditTarget(row);
    setEditDraft({
      word: row.word,
      hanViet: row.hanViet,
      type: row.type,
      reading: row.reading,
      meaning: row.meaning,
    });
  }

  async function saveEdit() {
    if (!editTarget) {
      return;
    }

    setIsBusy(true);
    setMessage("");

    try {
      const response = await requestJson<{
        ok: true;
        data: StandaloneVocabularyData;
      }>("/api/vocab/items/edit", {
        method: "PATCH",
        body: JSON.stringify({
          id: editTarget.id,
          data: editDraft,
        }),
      });
      setData(response.data);
      setEditTarget(null);
      setMessage("Vocabulary word updated.");
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

    try {
      const response = await requestJson<{
        ok: true;
        data: StandaloneVocabularyData;
      }>("/api/vocab/items/delete", {
        method: "DELETE",
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      setData(response.data);
      setDeleteTarget(null);
      setMessage("Vocabulary word deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete word");
    } finally {
      setIsBusy(false);
    }
  }

  function updateAnswer(row: StandaloneVocabularyRow, value: string) {
    if (mode === "study") {
      return;
    }

    setAnswers((current) => ({
      ...current,
      [answerKey(row.id, mode)]: { value, status: "neutral", revealed: false },
    }));
  }

  async function submitAnswer(row: StandaloneVocabularyRow) {
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

    requestJson("/api/vocab/attempts", {
      method: "POST",
      body: JSON.stringify({
        vocabularyItemId: row.id,
        mode,
        answer: current,
        isCorrect,
      }),
    }).catch(() => undefined);
  }

  function revealRow(row: StandaloneVocabularyRow) {
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

  async function setupAnki() {
    setIsAnkiBusy(true);
    setAnkiMessage("");
    try {
      const response = await requestJson<{
        ok: boolean;
        steps?: string[];
        message?: string;
      }>("/api/vocab/anki/setup", { method: "POST" });
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
      await requestJson<{ ok: boolean }>("/api/vocab/anki/sync", {
        method: "POST",
      });
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
      }>("/api/vocab/anki/reset", {
        method: "POST",
        body: JSON.stringify({
          confirmDeckReset: true,
          confirmDatabaseReset: true,
        }),
      });

      setData(clearAllStandaloneVocabularyAnkiIds);
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

  async function saveToAnki(row: StandaloneVocabularyRow) {
    setSavingAnkiIds((current) => new Set(current).add(row.id));
    try {
      const response = await requestJson<{
        ok: boolean;
        ankiNoteId?: number;
        message?: string;
      }>("/api/vocab/anki/save", {
        method: "POST",
        body: JSON.stringify({ vocabularyId: row.id }),
      });
      setData((current) =>
        replaceStandaloneVocabularyAnkiId(
          current,
          row.id,
          response.ankiNoteId ?? null,
        ),
      );
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

  return (
    <section className="app-panel">
      <section className="app-header" aria-label="Vocabulary header">
        <div>
          <h1>Vocabulary Spreadsheet</h1>
          <p>Study standalone vocabulary groups, move words between lessons, and save cards to a separate Anki deck.</p>
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
                <DialogTitle className="import-title">Add Vocabulary JSON</DialogTitle>
                <DialogDescription>
                  Paste one vocabulary group JSON, review it, then import it.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                className="json-input"
                aria-label="Paste vocabulary JSON here"
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
                <VocabularyImportPreviewPanel
                  preview={preview}
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
            title="Refresh vocabulary data"
            onClick={() => loadData()}
          >
            <RefreshCw size={16} />
          </Button>
          <Dialog open={isAnkiDialogOpen} onOpenChange={setIsAnkiDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm">
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
                <DialogTitle>Vocabulary Anki connection</DialogTitle>
                <DialogDescription>
                  Save each standalone vocabulary row as its own note.
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
                  <p>{ankiStatus?.deckReady ? "Standalone vocabulary notes will be saved here." : "Run setup to create the deck."}</p>
                </div>
                <div className="anki-status-card">
                  <span className="anki-status-label">Saved</span>
                  <strong>
                    {ankiProgress.saved}/{ankiProgress.total}
                  </strong>
                  <p>Saved rows become locked in the Anki column.</p>
                </div>
              </div>
              <div className="toolbar">
                <Button type="button" onClick={setupAnki} disabled={isAnkiBusy}>
                  {isAnkiBusy ? "Setting up..." : "Setup deck & note type"}
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
                >
                  <Trash2 size={15} />
                  Reset saved data
                </Button>
              </div>
              {ankiMessage ? <Feedback message={ankiMessage} errors={[]} /> : null}
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
          <AnkiResetDialogs
            step={ankiResetStep}
            deckName={ankiStatus?.deckName || "Vocabulary Learning"}
            isBusy={isAnkiBusy}
            onStepChange={setAnkiResetStep}
            onReset={resetAnkiSavedData}
          />
        </div>
      </section>
      {!isImportOpen ? <Feedback message={message} errors={[]} /> : null}

      <section className="controls-band" aria-label="Vocabulary study controls">
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
            <Button type="button" variant="outline" size="sm" onClick={() => resetAnswers("wrong")}>
              Reset Wrong
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => resetAnswers("correct")}>
              Reset Correct
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => resetAnswers("all")}>
              Reset All
            </Button>
          </div>
        ) : null}
      </section>

      <section className="table-wrap" aria-label="Vocabulary table">
        <table className="kanji-table vocabulary-table">
          <colgroup>
            <col className="col-collapse" />
            <col className="col-word" />
            <col className="col-wordHanViet" />
            <col className="col-type" />
            <col className="col-reading" />
            <col className="col-meaning" />
            <col className="col-example" />
            <col className="col-answer" />
            <col className="col-reveal" />
            <col className="col-anki" />
          </colgroup>
          <thead>
            <tr>
              <th className="col-collapse" />
              <th className="col-word">Word</th>
              <th className="col-wordHanViet">Han Viet</th>
              <th className="col-type">Type</th>
              <th className="col-reading">Reading</th>
              <th className="col-meaning">Meaning</th>
              <th className="col-example">Example</th>
              <th className="col-answer">Answer</th>
              <th className="col-reveal" />
              <th className="col-anki">Anki</th>
            </tr>
          </thead>
          {data.groups.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={10} className="empty-cell">
                  No vocabulary imported yet.
                </td>
              </tr>
            </tbody>
          ) : (
            data.groups.map((group, groupIndex) => (
              <VocabularyGroupBody
                key={group.id}
                group={group}
                groupIndex={groupIndex}
                groupCount={data.groups.length}
                mode={mode}
                answers={answers}
                editingGroupId={editingGroupId}
                editingGroupName={editingGroupName}
                ankiReady={ankiReady}
                savingAnkiIds={savingAnkiIds}
                onEditingGroupNameChange={setEditingGroupName}
                onStartRenameGroup={startRenameGroup}
                onCancelRenameGroup={() => setEditingGroupId(null)}
                onSaveGroupName={saveGroupName}
                onToggleGroup={() => toggleGroup(group)}
                onMoveItem={moveItem}
                onAnswerChange={updateAnswer}
                onSubmitAnswer={submitAnswer}
                onRevealRow={revealRow}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
                onSaveAnki={saveToAnki}
              />
            ))
          )}
        </table>
      </section>
      <VocabularyEditDialog
        target={editTarget}
        draft={editDraft}
        isBusy={isBusy}
        onDraftChange={(patch) =>
          setEditDraft((current) => ({ ...current, ...patch }))
        }
        onSave={saveEdit}
        onClose={() => setEditTarget(null)}
      />
      <VocabularyDeleteDialog
        target={deleteTarget}
        isBusy={isBusy}
        onDelete={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </section>
  );
}

function VocabularyGroupBody({
  group,
  groupIndex,
  groupCount,
  mode,
  answers,
  editingGroupId,
  editingGroupName,
  ankiReady,
  savingAnkiIds,
  onEditingGroupNameChange,
  onStartRenameGroup,
  onCancelRenameGroup,
  onSaveGroupName,
  onToggleGroup,
  onMoveItem,
  onAnswerChange,
  onSubmitAnswer,
  onRevealRow,
  onEdit,
  onDelete,
  onSaveAnki,
}: {
  group: StandaloneVocabularyGroup;
  groupIndex: number;
  groupCount: number;
  mode: StudyMode;
  answers: Record<string, AnswerState>;
  editingGroupId: string | null;
  editingGroupName: string;
  ankiReady: boolean;
  savingAnkiIds: Set<string>;
  onEditingGroupNameChange: (value: string) => void;
  onStartRenameGroup: (group: StandaloneVocabularyGroup) => void;
  onCancelRenameGroup: () => void;
  onSaveGroupName: (groupId: string) => void;
  onToggleGroup: () => void;
  onMoveItem: (
    type: StandaloneVocabularyMoveTargetType,
    id: string,
    direction: MoveDirection,
  ) => void;
  onAnswerChange: (row: StandaloneVocabularyRow, value: string) => void;
  onSubmitAnswer: (row: StandaloneVocabularyRow) => void;
  onRevealRow: (row: StandaloneVocabularyRow) => void;
  onEdit: (row: StandaloneVocabularyRow) => void;
  onDelete: (row: StandaloneVocabularyRow) => void;
  onSaveAnki: (row: StandaloneVocabularyRow) => void;
}) {
  return (
    <tbody className={group.isCollapsed ? "vocabulary-group is-collapsed" : "vocabulary-group"}>
      <tr className="vocabulary-group-header">
        <td className="col-collapse control-cell">
          <Button
            className="cell-icon-button"
            type="button"
            variant="ghost"
            size="icon-sm"
            title={group.isCollapsed ? "Expand group" : "Collapse group"}
            onClick={onToggleGroup}
          >
            {group.isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
          </Button>
        </td>
        <td colSpan={9} className="vocabulary-group-title-cell">
          <div className="vocabulary-group-title-row">
            <MoveButtons
              label={`vocabulary group ${group.name}`}
              onMove={(direction) => onMoveItem("vocabGroup", group.id, direction)}
              disableUp={groupIndex === 0}
              disableDown={groupIndex >= groupCount - 1}
            />
            {editingGroupId === group.id ? (
              <div className="group-name-edit">
                <input
                  aria-label="Edit vocabulary group name"
                  value={editingGroupName}
                  onChange={(event) =>
                    onEditingGroupNameChange(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onSaveGroupName(group.id);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title="Save group name"
                  onClick={() => onSaveGroupName(group.id)}
                >
                  <Save size={14} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title="Cancel group rename"
                  onClick={onCancelRenameGroup}
                >
                  <X size={14} />
                </Button>
              </div>
            ) : (
              <>
                <strong>{group.name}</strong>
                <Badge variant="secondary">{group.vocabulary.length} words</Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title={`Rename ${group.name}`}
                  onClick={() => onStartRenameGroup(group)}
                >
                  <Pencil size={13} />
                </Button>
              </>
            )}
          </div>
        </td>
      </tr>
      {group.isCollapsed ? null : group.vocabulary.length === 0 ? (
        <tr>
          <td colSpan={10} className="empty-cell">
            Empty vocabulary group
          </td>
        </tr>
      ) : (
        group.vocabulary.map((row, rowIndex) => {
          const answerState =
            mode !== "study" ? answers[answerKey(row.id, mode)] : undefined;
          const shouldReveal = answerState?.revealed || answerState?.status === "correct";

          return (
            <tr key={row.id} className="vocabulary-row">
              <td className="col-collapse control-cell" />
              <VocabularySuppressedCell column="word" mode={mode} shouldReveal={shouldReveal}>
                <div className="word-cell-content">
                  <MoveButtons
                    label={`vocabulary ${row.word}`}
                    onMove={(direction) =>
                      onMoveItem("standaloneVocabulary", row.id, direction)
                    }
                    disableUp={groupIndex === 0 && rowIndex === 0}
                    disableDown={
                      groupIndex >= groupCount - 1 &&
                      rowIndex >= group.vocabulary.length - 1
                    }
                  />
                  <span>{row.word}</span>
                  <ItemButtons
                    label={`word ${row.word}`}
                    onEdit={() => onEdit(row)}
                    onDelete={() => onDelete(row)}
                  />
                </div>
              </VocabularySuppressedCell>
              <VocabularySuppressedCell column="wordHanViet" mode={mode} shouldReveal={shouldReveal}>
                {row.hanViet}
              </VocabularySuppressedCell>
              <VocabularySuppressedCell column="type" mode={mode} shouldReveal={shouldReveal}>
                <span className={vocabTypeClass(row.type)}>{row.type}</span>
              </VocabularySuppressedCell>
              <VocabularySuppressedCell column="reading" mode={mode} shouldReveal={shouldReveal}>
                {row.reading}
              </VocabularySuppressedCell>
              <VocabularySuppressedCell column="meaning" mode={mode} shouldReveal={shouldReveal}>
                {row.meaning}
              </VocabularySuppressedCell>
              <VocabularySuppressedCell column="example" mode={mode} shouldReveal={shouldReveal}>
                <div className="example-stack">
                  {row.examples.slice(0, 3).map((example, index) => (
                    <ExampleText
                      key={`${row.id}-${index}`}
                      tokens={example.japanese}
                      vietnamese={example.vietnamese}
                    />
                  ))}
                </div>
              </VocabularySuppressedCell>
              <td className={answerCellClass(answerState)}>
                {mode !== "study" ? (
                  <div className="answer-box">
                    <input
                      aria-label={`Answer for ${row.word || row.meaning}`}
                      value={answerState?.value ?? ""}
                      onChange={(event) => onAnswerChange(row, event.target.value)}
                      onKeyDown={(event) => {
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
              <td className="col-reveal reveal-cell">
                {mode !== "study" ? (
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
              <td className="col-anki anki-cell">
                <AnkiCell
                  row={row}
                  ready={ankiReady}
                  saving={savingAnkiIds.has(row.id)}
                  onSave={() => onSaveAnki(row)}
                />
              </td>
            </tr>
          );
        })
      )}
    </tbody>
  );
}

function VocabularyImportPreviewPanel({
  preview,
  onImport,
  isBusy,
}: {
  preview: StandaloneVocabularyImportPreview;
  onImport: () => void;
  isBusy: boolean;
}) {
  return (
    <div className="preview-panel">
      <div className="preview-summary">
        <Badge variant="secondary">Group: {preview.groupName}</Badge>
        <Badge variant="secondary">Words: {preview.summary.vocabulary}</Badge>
        <Badge variant="secondary">Examples: {preview.summary.examples}</Badge>
      </div>
      <div className="review-table-wrap">
        <table className="kanji-table review-table">
          <thead>
            <tr>
              <th className="col-word">Word</th>
              <th className="col-wordHanViet">Han Viet</th>
              <th className="col-type">Type</th>
              <th className="col-reading">Reading</th>
              <th className="col-meaning">Meaning</th>
              <th className="col-example">Examples</th>
            </tr>
          </thead>
          <tbody>
            {preview.vocabulary.map((row) => (
              <tr key={`${preview.groupName}-${row.word}-${row.reading}`}>
                <td className="col-word">{row.word}</td>
                <td className="col-wordHanViet">{row.han_viet}</td>
                <td className="col-type">
                  <span className={vocabTypeClass(row.type)}>{row.type}</span>
                </td>
                <td className="col-reading">{row.reading}</td>
                <td className="col-meaning">{row.meaning}</td>
                <td className="col-example">
                  <div className="example-stack">
                    {row.examples.slice(0, 3).map((example, index) => (
                      <ExampleText
                        key={`${row.word}-${index}`}
                        tokens={example.japanese}
                        vietnamese={example.vietnamese}
                      />
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="import-action-row">
        <Button type="button" size="lg" onClick={onImport} disabled={isBusy}>
          Import
        </Button>
      </div>
    </div>
  );
}

function VocabularyEditDialog({
  target,
  draft,
  isBusy,
  onDraftChange,
  onSave,
  onClose,
}: {
  target: StandaloneVocabularyRow | null;
  draft: EditDraft;
  isBusy: boolean;
  onDraftChange: (patch: Partial<EditDraft>) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="item-dialog">
        <DialogHeader>
          <DialogTitle>Edit Vocabulary Word</DialogTitle>
          <DialogDescription>
            Save updates to word, Han Viet, type, reading, and meaning. Examples are unchanged.
          </DialogDescription>
        </DialogHeader>
        <div className="edit-form-grid">
          <label>
            Word
            <input
              aria-label="Edit vocabulary word"
              value={draft.word}
              onChange={(event) => onDraftChange({ word: event.target.value })}
            />
          </label>
          <label>
            Han Viet
            <input
              aria-label="Edit vocabulary Han Viet"
              value={draft.hanViet}
              onChange={(event) => onDraftChange({ hanViet: event.target.value })}
            />
          </label>
          <label>
            Type
            <Select
              value={draft.type}
              onValueChange={(value) => onDraftChange({ type: value as VocabularyType })}
            >
              <SelectTrigger aria-label="Edit vocabulary type">
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
              aria-label="Edit vocabulary reading"
              value={draft.reading}
              onChange={(event) => onDraftChange({ reading: event.target.value })}
            />
          </label>
          <label>
            Meaning
            <input
              aria-label="Edit vocabulary meaning"
              value={draft.meaning}
              onChange={(event) => onDraftChange({ meaning: event.target.value })}
            />
          </label>
        </div>
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

function VocabularyDeleteDialog({
  target,
  isBusy,
  onDelete,
  onClose,
}: {
  target: StandaloneVocabularyRow | null;
  isBusy: boolean;
  onDelete: () => void;
  onClose: () => void;
}) {
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
            <strong>Level:</strong> Word
          </p>
          <p>
            <strong>Item:</strong> {target?.word ?? ""}
          </p>
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

function AnkiResetDialogs({
  step,
  deckName,
  isBusy,
  onStepChange,
  onReset,
}: {
  step: AnkiResetStep;
  deckName: string;
  isBusy: boolean;
  onStepChange: (step: AnkiResetStep) => void;
  onReset: () => void;
}) {
  return (
    <>
      <Dialog
        open={step === "first"}
        onOpenChange={(open) => onStepChange(open ? "first" : "none")}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset vocabulary Anki saved data?</DialogTitle>
            <DialogDescription>
              This will delete every note in the configured vocabulary Anki deck if the deck still exists, then clear all Saved badges in this app.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onStepChange("none")} disabled={isBusy}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => onStepChange("second")} disabled={isBusy}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={step === "second"}
        onOpenChange={(open) => onStepChange(open ? "second" : "none")}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Final confirmation</DialogTitle>
            <DialogDescription>
              This cannot be undone from the app. All cards in the Anki deck{" "}
              <strong>{deckName}</strong> will be removed if that deck exists, and every standalone vocabulary row will return to the unsaved state.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onStepChange("none")} disabled={isBusy}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={onReset} disabled={isBusy}>
              {isBusy ? "Resetting..." : "Reset everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MoveButtons({
  label,
  onMove,
  disableUp = false,
  disableDown = false,
}: {
  label: string;
  onMove: (direction: MoveDirection) => void;
  disableUp?: boolean;
  disableDown?: boolean;
}) {
  return (
    <div className="move-controls">
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
}: {
  label: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="item-controls">
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

function AnkiCell({
  row,
  ready,
  saving,
  onSave,
}: {
  row: StandaloneVocabularyRow;
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
      {saving ? "Saving..." : "Save to Anki"}
    </Button>
  );
}

function VocabularySuppressedCell({
  column,
  mode,
  shouldReveal,
  children,
}: {
  column: "word" | "wordHanViet" | "type" | "reading" | "meaning" | "example";
  mode: StudyMode;
  shouldReveal: boolean | undefined;
  children: React.ReactNode;
}) {
  const suppressed = !shouldReveal && isSuppressedByMode(column, mode);

  return (
    <td className={`col-${column}${suppressed ? " hidden-test-cell" : ""}`}>
      {suppressed ? "" : children}
    </td>
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

function isSuppressedByMode(
  column: "word" | "wordHanViet" | "type" | "reading" | "meaning" | "example",
  mode: StudyMode,
) {
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

function withAllVocabGroupsCollapsed(
  data: StandaloneVocabularyData,
  isCollapsed: boolean,
): StandaloneVocabularyData {
  return {
    ...data,
    groups: data.groups.map((group) => ({
      ...group,
      isCollapsed,
    })),
  };
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

function replaceStandaloneVocabularyAnkiId(
  data: StandaloneVocabularyData,
  vocabularyId: string,
  ankiNoteId: number | null,
): StandaloneVocabularyData {
  return {
    ...data,
    groups: data.groups.map((group) => ({
      ...group,
      vocabulary: group.vocabulary.map((row) =>
        row.id === vocabularyId ? { ...row, ankiNoteId } : row,
      ),
    })),
  };
}

function clearAllStandaloneVocabularyAnkiIds(
  data: StandaloneVocabularyData,
): StandaloneVocabularyData {
  return {
    ...data,
    groups: data.groups.map((group) => ({
      ...group,
      vocabulary: group.vocabulary.map((row) => ({ ...row, ankiNoteId: null })),
    })),
  };
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

async function fetchVocabularyAnkiStatus(): Promise<AnkiStatus> {
  try {
    return await requestJson<AnkiStatus & { ok: boolean }>("/api/vocab/anki/status");
  } catch (error) {
    return {
      reachable: false,
      deckReady: false,
      modelReady: false,
      message: error instanceof Error ? error.message : "Anki check failed",
    };
  }
}
