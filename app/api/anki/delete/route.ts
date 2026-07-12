import { NextResponse } from "next/server";
import { AnkiConnectError, ankiDeleteNotes } from "@/lib/anki";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Remove the Anki note for a saved vocabulary row, then clear the stored note id.
// The DB row itself is untouched here — this is the "unsync" path used when the
// user wants to re-save or stop tracking a card. Deleting the DB row uses the
// items/delete route which mirrors the note removal.
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
    select: { ankiNoteId: true },
  });

  if (!row) {
    return NextResponse.json(
      { ok: false, message: "Vocabulary item not found" },
      { status: 404 },
    );
  }

  if (!row.ankiNoteId) {
    return NextResponse.json({ ok: true, ankiNoteId: null });
  }

  try {
    await ankiDeleteNotes([Number(row.ankiNoteId)]);
  } catch (error) {
    const message =
      error instanceof AnkiConnectError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to delete note from Anki.";

    return NextResponse.json({ ok: false, message }, { status: 502 });
  }

  await prisma.vocabularyItem.update({
    where: { id: body.vocabularyId },
    data: { ankiNoteId: null },
  });

  return NextResponse.json({ ok: true, ankiNoteId: null });
}
