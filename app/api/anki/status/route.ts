import { NextResponse } from "next/server";
import {
  ANKI_DECK_NAME,
  ANKI_MODEL_NAME,
  AnkiConnectError,
  ankiDeckNames,
  ankiModelFieldNames,
  ankiModelNames,
  ankiVersion,
} from "@/lib/anki";
import { ANKI_FIELD_ORDER } from "@/lib/anki";

export const runtime = "nodejs";

// Report whether AnkiConnect is reachable and whether the deck + note type are
// ready. Used by the header button to decide between Setup / Sync / Saved state.
export async function GET() {
  try {
    await ankiVersion();
  } catch (error) {
    const message =
      error instanceof AnkiConnectError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Cannot reach AnkiConnect.";

    return NextResponse.json(
      {
        ok: false,
        reachable: false,
        deckReady: false,
        modelReady: false,
        message,
      },
      { status: 200 },
    );
  }

  const [decks, models] = await Promise.all([ankiDeckNames(), ankiModelNames()]);
  const deckReady = decks.includes(ANKI_DECK_NAME);
  const modelExists = models.includes(ANKI_MODEL_NAME);

  let modelReady = false;

  if (modelExists) {
    try {
      const fields = await ankiModelFieldNames(ANKI_MODEL_NAME);
      modelReady = ANKI_FIELD_ORDER.every((field) => fields.includes(field));
    } catch {
      modelReady = false;
    }
  }

  return NextResponse.json({
    ok: true,
    reachable: true,
    deckReady,
    modelReady,
    deckName: ANKI_DECK_NAME,
    modelName: ANKI_MODEL_NAME,
  });
}
