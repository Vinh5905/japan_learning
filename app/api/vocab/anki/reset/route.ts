import { NextResponse } from "next/server";
import {
  VOCABULARY_ANKI_DECK_NAME,
  AnkiConnectError,
  ankiDeckNames,
  ankiDeleteNotes,
  ankiFindNotes,
  ankiVersion,
} from "@/lib/anki";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    confirmDeckReset?: unknown;
    confirmDatabaseReset?: unknown;
  };

  if (body.confirmDeckReset !== true || body.confirmDatabaseReset !== true) {
    return NextResponse.json(
      {
        ok: false,
        message: "Both reset confirmations are required.",
      },
      { status: 400 },
    );
  }

  try {
    await ankiVersion();
  } catch (error) {
    const message =
      error instanceof AnkiConnectError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Cannot reach AnkiConnect.";

    return NextResponse.json({ ok: false, message }, { status: 502 });
  }

  try {
    const decks = await ankiDeckNames();
    const deckFound = decks.includes(VOCABULARY_ANKI_DECK_NAME);
    let deletedNotes = 0;

    if (deckFound) {
      const noteIds = await ankiFindNotes(
        `deck:${quoteAnkiSearch(VOCABULARY_ANKI_DECK_NAME)}`,
      );
      deletedNotes = noteIds.length;

      if (noteIds.length > 0) {
        await ankiDeleteNotes(noteIds);
      }
    }

    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS "count"
      FROM "standalone_vocabulary_items"
      WHERE "anki_note_id" IS NOT NULL
    `;
    const clearedRows = rows[0]?.count ?? 0;

    await prisma.$executeRaw`
      UPDATE "standalone_vocabulary_items"
      SET "anki_note_id" = NULL, "updated_at" = NOW()
      WHERE "anki_note_id" IS NOT NULL
    `;

    return NextResponse.json({
      ok: true,
      deckFound,
      deletedNotes,
      clearedRows,
    });
  } catch (error) {
    const message =
      error instanceof AnkiConnectError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to reset Anki saved data.";

    return NextResponse.json({ ok: false, message }, { status: 502 });
  }
}

function quoteAnkiSearch(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
