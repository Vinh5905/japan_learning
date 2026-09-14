import { NextResponse } from "next/server";
import {
  VOCABULARY_ANKI_DECK_NAME,
  VOCABULARY_ANKI_FIELD_ORDER,
  VOCABULARY_ANKI_MODEL_NAME,
  AnkiConnectError,
  ankiAddNote,
  ankiDeckNames,
  ankiFindNotes,
  ankiModelFieldNames,
  ankiModelNames,
  ankiNotesInfo,
  ankiUpdateNoteFields,
  buildStandaloneVocabularyAnkiFields,
} from "@/lib/anki";
import { prisma } from "@/lib/prisma";
import { asVocabularyExamples } from "@/lib/vocab-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { vocabularyId?: unknown };

  if (typeof body.vocabularyId !== "string") {
    return NextResponse.json(
      { ok: false, message: "vocabularyId is required" },
      { status: 400 },
    );
  }

  const row = await prisma.standaloneVocabularyItem.findUnique({
    where: { id: body.vocabularyId },
  });

  if (!row) {
    return NextResponse.json(
      { ok: false, message: "Vocabulary item not found" },
      { status: 404 },
    );
  }

  let noteId: number;

  try {
    const [decks, models] = await Promise.all([
      ankiDeckNames(),
      ankiModelNames(),
    ]);

    if (!decks.includes(VOCABULARY_ANKI_DECK_NAME)) {
      return NextResponse.json(
        {
          ok: false,
          message: `Anki deck "${VOCABULARY_ANKI_DECK_NAME}" not found. Run Anki setup first.`,
        },
        { status: 409 },
      );
    }

    if (!models.includes(VOCABULARY_ANKI_MODEL_NAME)) {
      return NextResponse.json(
        {
          ok: false,
          message: `Anki note type "${VOCABULARY_ANKI_MODEL_NAME}" not found. Run Anki setup first.`,
        },
        { status: 409 },
      );
    }

    const fields = await ankiModelFieldNames(VOCABULARY_ANKI_MODEL_NAME);
    const ready = VOCABULARY_ANKI_FIELD_ORDER.every((field) =>
      fields.includes(field),
    );

    if (!ready) {
      return NextResponse.json(
        {
          ok: false,
          message: `Note type "${VOCABULARY_ANKI_MODEL_NAME}" is missing fields. Re-run Anki setup.`,
        },
        { status: 409 },
      );
    }

    const fieldMap = buildStandaloneVocabularyAnkiFields({
      word: row.word,
      hanViet: row.hanViet,
      type: row.type as Parameters<
        typeof buildStandaloneVocabularyAnkiFields
      >[0]["type"],
      reading: row.reading,
      meaning: row.meaning,
      examples: asVocabularyExamples(row.examples),
    });

    if (row.ankiNoteId) {
      noteId = Number(row.ankiNoteId);
      await ankiUpdateNoteFields({ id: noteId, fields: fieldMap });
    } else {
      const existingNoteId = await findStandaloneVocabularyNoteId(row.word);

      if (existingNoteId) {
        await ankiUpdateNoteFields({ id: existingNoteId, fields: fieldMap });
        noteId = existingNoteId;
      } else {
        try {
          noteId = await ankiAddNote({
            deckName: VOCABULARY_ANKI_DECK_NAME,
            modelName: VOCABULARY_ANKI_MODEL_NAME,
            fields: fieldMap,
          });
          if (typeof noteId !== "number") {
            const noteIdAfterAdd = await findStandaloneVocabularyNoteId(row.word);

            if (!noteIdAfterAdd) {
              throw new Error("Anki did not return a note id.");
            }

            noteId = noteIdAfterAdd;
          }
        } catch (error) {
          const noteIdAfterAdd = await findStandaloneVocabularyNoteId(row.word);

          if (!noteIdAfterAdd) {
            throw error;
          }

          await ankiUpdateNoteFields({ id: noteIdAfterAdd, fields: fieldMap });
          noteId = noteIdAfterAdd;
        }
      }
    }
  } catch (error) {
    const message =
      error instanceof AnkiConnectError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to save note to Anki.";

    return NextResponse.json({ ok: false, message }, { status: 502 });
  }

  await prisma.$executeRaw`
    UPDATE "standalone_vocabulary_items"
    SET "anki_note_id" = ${BigInt(noteId)}, "updated_at" = NOW()
    WHERE "id" = ${row.id}
  `;

  return NextResponse.json({ ok: true, ankiNoteId: noteId });
}

async function findStandaloneVocabularyNoteId(word: string): Promise<number | null> {
  const query = [
    `deck:${quoteAnkiSearch(VOCABULARY_ANKI_DECK_NAME)}`,
    `note:${quoteAnkiSearch(VOCABULARY_ANKI_MODEL_NAME)}`,
    quoteAnkiSearch(word),
  ].join(" ");
  const noteIds = await ankiFindNotes(query);

  if (noteIds.length === 0) {
    return null;
  }

  const notes = await ankiNotesInfo(noteIds);
  const match = notes.find(
    (note) =>
      note.modelName === VOCABULARY_ANKI_MODEL_NAME &&
      stripHtml(note.fields.Word?.value ?? "") === word,
  );

  return match?.noteId ?? null;
}

function quoteAnkiSearch(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, "").trim();
}
