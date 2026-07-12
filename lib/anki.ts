import { getPlainJapanese } from "@/lib/study";
import type { ExampleToken, VocabularyType } from "@/lib/types";

// AnkiConnect runs on the machine that has Anki open. The web app's backend
// talks to it. Allow overriding the host/port for non-default setups.
const ANKI_CONNECT_URL =
  process.env.ANKI_CONNECT_URL?.trim() || "http://127.0.0.1:8765";

export const ANKI_DECK_NAME = "Kanji Learning";
export const ANKI_MODEL_NAME = "Kanji Vocabulary";

// Field names are stable strings stored inside the Anki note. They mirror the
// database column names so the mapping is obvious and stays unconfusing.
export const ANKI_FIELDS = {
  Kanji: "Kanji",
  Hiragana: "Hiragana",
  "Chinese character": "Chinese character",
  Meaning: "Meaning",
  "Loại từ": "Loại từ",
  "Example 1": "Example 1",
  "Meaning 1": "Meaning 1",
} as const;

export type AnkiFieldName = (typeof ANKI_FIELDS)[keyof typeof ANKI_FIELDS];

export const ANKI_FIELD_ORDER: AnkiFieldName[] = [
  ANKI_FIELDS.Kanji,
  ANKI_FIELDS.Hiragana,
  ANKI_FIELDS["Chinese character"],
  ANKI_FIELDS.Meaning,
  ANKI_FIELDS["Loại từ"],
  ANKI_FIELDS["Example 1"],
  ANKI_FIELDS["Meaning 1"],
];

// English label kept next to the Vietnamese type so the card is self-explanatory
// without changing the stored value.
const VOCABULARY_TYPE_LABEL: Record<VocabularyType, string> = {
  "danh từ": "Danh từ (noun)",
  "tính từ i": "Tính từ i (i-adjective)",
  "tính từ na": "Tính từ na (na-adjective)",
  "tha động từ": "Tha động từ (transitive verb)",
  "tự động từ": "Tự động từ (intransitive verb)",
};

type AnkiConnectResult<T> = {
  result: T;
  error: string | null;
};

export class AnkiConnectError extends Error {
  constructor(message: string, readonly action: string) {
    super(message);
    this.name = "AnkiConnectError";
  }
}

async function invoke<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(ANKI_CONNECT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, version: 6, params }),
    });
  } catch {
    throw new AnkiConnectError(
      `Cannot reach AnkiConnect at ${ANKI_CONNECT_URL}. Is Anki running with the AnkiConnect add-on enabled?`,
      action,
    );
  }

  if (!response.ok) {
    throw new AnkiConnectError(
      `AnkiConnect returned HTTP ${response.status}`,
      action,
    );
  }

  const body = (await response.json()) as AnkiConnectResult<T>;

  if (body.error) {
    throw new AnkiConnectError(body.error, action);
  }

  return body.result;
}

// Probe whether AnkiConnect is reachable and reports a compatible version.
export async function ankiVersion(): Promise<number> {
  return invoke<number>("version");
}

export async function ankiDeckNames(): Promise<string[]> {
  return invoke<string[]>("deckNames");
}

export async function ankiModelNames(): Promise<string[]> {
  return invoke<string[]>("modelNames");
}

export async function ankiModelFieldNames(modelName: string): Promise<string[]> {
  return invoke<string[]>("modelFieldNames", { modelName });
}

export async function ankiCreateDeck(deck: string): Promise<number> {
  return invoke<number>("createDeck", { deck });
}

export async function ankiCreateModel(params: {
  modelName: string;
  inOrderFields: string[];
  css: string;
  cardTemplates: Array<{ Name: string; Front: string; Back: string }>;
}): Promise<unknown> {
  return invoke("createModel", params);
}

export async function ankiFindNotes(query: string): Promise<number[]> {
  return invoke<number[]>("findNotes", { query });
}

export async function ankiNotesInfo(noteIds: number[]) {
  return invoke<
    Array<{
      noteId: number;
      modelName: string;
      fields: Record<string, { value: string; order: number }>;
      tags: string[];
    }>
  >("notesInfo", { notes: noteIds });
}

export async function ankiAddNote(params: {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
  tags?: string[];
}): Promise<number> {
  return invoke<number>("addNote", {
    note: {
      deckName: params.deckName,
      modelName: params.modelName,
      fields: params.fields,
      tags: params.tags ?? [],
      options: { allowDuplicate: false },
    },
  });
}

export async function ankiUpdateNoteFields(params: {
  id: number;
  fields: Record<string, string>;
}): Promise<unknown> {
  return invoke("updateNoteFields", {
    note: { id: params.id, fields: params.fields },
  });
}

export async function ankiDeleteNotes(noteIds: number[]): Promise<unknown> {
  return invoke("deleteNotes", { notes: noteIds });
}

export async function ankiSync(): Promise<unknown> {
  return invoke("sync");
}

// Convert furigana tokens to Anki ruby markup. Each token with a reading renders
// as <ruby>text<rt>reading</rt></ruby>; the target vocabulary is bold/italic/
// underlined so it stands out in the full sentence, matching the app styling.
export function buildExampleHtml(tokens: ExampleToken[]): string {
  return tokens
    .map((token) => {
      const inner = escapeHtml(token.text);

      if (token.is_target) {
        return `<b><i><u>${inner}</u></i></b>`;
      }

      if (token.reading) {
        return `<ruby>${inner}<rt>${escapeHtml(token.reading)}</rt></ruby>`;
      }

      return inner;
    })
    .join("");
}

export function buildExamplePlain(tokens: ExampleToken[]): string {
  return getPlainJapanese(tokens);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Map one vocabulary row to one Anki note. The field named "Kanji" is kept for
// compatibility with the existing Anki note type, but it stores the full
// vocabulary word, not the parent level-1 kanji.
export function buildAnkiFields(input: {
  kanji: string;
  word: string;
  hanViet: string;
  type: VocabularyType;
  reading: string;
  meaning: string;
  exampleJapanese: ExampleToken[];
  exampleVietnamese: string;
}): Record<string, string> {
  return {
    [ANKI_FIELDS.Kanji]: input.word,
    [ANKI_FIELDS.Hiragana]: input.reading,
    [ANKI_FIELDS["Chinese character"]]: input.hanViet,
    [ANKI_FIELDS.Meaning]: input.meaning,
    [ANKI_FIELDS["Loại từ"]]: VOCABULARY_TYPE_LABEL[input.type],
    [ANKI_FIELDS["Example 1"]]: buildExampleHtml(input.exampleJapanese),
    [ANKI_FIELDS["Meaning 1"]]: input.exampleVietnamese,
  };
}

export const ANKI_CARD_TEMPLATES = [
  {
    Name: "Recognition",
    Front: `<div class='card-inside'>
  {{Kanji}}
</div>

<div style="line-height: 1; margin: 40px 0">
    <p style="font-weight: bold">Example 1: </p>
    <div style="padding-left:10px">
        <p>{{Example 1}}<p>
    </div>
</div>`,
    Back: `<div class='card-inside'>
  {{Kanji}}
</div>

<hr id=answer>

<div style="font-size: 30px; margin: 16px; text-align: center; font-weight: bold;">
  {{Hiragana}}
</div>

<div style="font-size: 30px; text-align: center; margin: 16px; font-weight: bold;">
  {{Chinese character}}
</div>

<div style="font-size: 25px; text-align: center; margin: 16px; font-weight: 300">
  {{Meaning}}
</div>

<div style="font-size: 20px; text-align: center; margin: 16px; color:#ae6901; font-weight: 600">
  {{Loại từ}}
</div>

<div style="line-height: 1; margin: 40px 0">
    <p style="font-weight: bold">Example 1: </p>
    <div style="padding-left:10px">
        <p>{{Example 1}}<p>
        <p>{{Meaning 1}}<p>
    </div>
</div>`,
  },
];

export const ANKI_CARD_CSS = `.card {
    display:flex;
    align-items:center;
    justify-content:center;
    height: 100vh;
    box-sizing: border-box;
    margin: 0;
    padding:20px;
    background: #fdfdfd;
}

.card-inside {
    font-size: 80px;
    font-weight: bold;
    width: 100%;
    display:flex;
    align-items:center;
    justify-content:center;
    min-width: 300px
}`;
