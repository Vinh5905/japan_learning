import { NextResponse } from "next/server";
import {
  ANKI_DECK_NAME,
  ANKI_MODEL_NAME,
  ANKI_FIELD_ORDER,
  AnkiConnectError,
  ankiAddNote,
  ankiDeckNames,
  ankiFindNotes,
  ankiModelFieldNames,
  ankiModelNames,
  ankiNotesInfo,
  ankiUpdateNoteFields,
  buildAnkiFields,
} from "@/lib/anki";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Save one vocabulary row to Anki. Loads the row with its parent kanji, builds
// the note fields, then either creates a note (storing the returned id) or
// updates the existing note when the row was already saved.
export async function POST(request: Request) {
  const body = (await request.json()) as { vocabularyId?: unknown };

  if (typeof body.vocabularyId !== "string") {
    return NextResponse.json(
      { ok: false, message: "vocabularyId is required" },
      { status: 400 },
    );
  }

  const row = await prisma.vocabularyItem.findUnique({
    where: { id: body.vocabularyId },
    include: {
      kanjiItem: { select: { kanji: true, hanViet: true } },
    },
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

    if (!decks.includes(ANKI_DECK_NAME)) {
      return NextResponse.json(
        {
          ok: false,
          message: `Anki deck "${ANKI_DECK_NAME}" not found. Run Anki setup first.`,
        },
        { status: 409 },
      );
    }

    if (!models.includes(ANKI_MODEL_NAME)) {
      return NextResponse.json(
        {
          ok: false,
          message: `Anki note type "${ANKI_MODEL_NAME}" not found. Run Anki setup first.`,
        },
        { status: 409 },
      );
    }

    const fields = await ankiModelFieldNames(ANKI_MODEL_NAME);
    const ready = ANKI_FIELD_ORDER.every((field) => fields.includes(field));

    if (!ready) {
      return NextResponse.json(
        {
          ok: false,
          message: `Note type "${ANKI_MODEL_NAME}" is missing fields. Re-run Anki setup.`,
        },
        { status: 409 },
      );
    }

    const fieldMap = buildAnkiFields({
      kanji: row.kanjiItem.kanji,
      word: row.word,
      hanViet: row.hanViet || row.kanjiItem.hanViet,
      type: row.type as Parameters<typeof buildAnkiFields>[0]["type"],
      reading: row.reading,
      meaning: row.meaning,
      exampleJapanese:
        row.exampleJapanese as Parameters<typeof buildAnkiFields>[0]["exampleJapanese"],
      exampleVietnamese: row.exampleVietnamese,
    });

    if (row.ankiNoteId) {
      noteId = Number(row.ankiNoteId);
      await ankiUpdateNoteFields({ id: noteId, fields: fieldMap });
    } else {
      const existingNoteId = await findVocabularyNoteId(row.word);

      if (existingNoteId) {
        await ankiUpdateNoteFields({ id: existingNoteId, fields: fieldMap });
        noteId = existingNoteId;
      } else {
        try {
          noteId = await ankiAddNote({
            deckName: ANKI_DECK_NAME,
            modelName: ANKI_MODEL_NAME,
            fields: fieldMap,
          });
          if (typeof noteId !== "number") {
            const noteIdAfterAdd = await findVocabularyNoteId(row.word);

            if (!noteIdAfterAdd) {
              throw new Error("Anki did not return a note id.");
            }

            noteId = noteIdAfterAdd;
          }
        } catch (error) {
          const noteIdAfterAdd = await findVocabularyNoteId(row.word);

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
    UPDATE "vocabulary_items"
    SET "anki_note_id" = ${BigInt(noteId)}, "updated_at" = NOW()
    WHERE "id" = ${row.id}
  `;

  return NextResponse.json({ ok: true, ankiNoteId: noteId });
}

async function findVocabularyNoteId(word: string): Promise<number | null> {
  const query = [
    `deck:${quoteAnkiSearch(ANKI_DECK_NAME)}`,
    `note:${quoteAnkiSearch(ANKI_MODEL_NAME)}`,
    quoteAnkiSearch(word),
  ].join(" ");
  const noteIds = await ankiFindNotes(query);

  if (noteIds.length === 0) {
    return null;
  }

  const notes = await ankiNotesInfo(noteIds);
  const match = notes.find(
    (note) =>
      note.modelName === ANKI_MODEL_NAME &&
      stripHtml(note.fields.Kanji?.value ?? "") === word,
  );

  return match?.noteId ?? null;
}

function quoteAnkiSearch(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, "").trim();
}
