import { NextResponse } from "next/server";
import {
  VOCABULARY_ANKI_DECK_NAME,
  VOCABULARY_ANKI_FIELD_ORDER,
  VOCABULARY_ANKI_MODEL_NAME,
  AnkiConnectError,
  ankiDeckNames,
  ankiModelFieldNames,
  ankiModelNames,
  ankiVersion,
} from "@/lib/anki";

export const runtime = "nodejs";

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
  const deckReady = decks.includes(VOCABULARY_ANKI_DECK_NAME);
  const modelExists = models.includes(VOCABULARY_ANKI_MODEL_NAME);

  let modelReady = false;

  if (modelExists) {
    try {
      const fields = await ankiModelFieldNames(VOCABULARY_ANKI_MODEL_NAME);
      modelReady = VOCABULARY_ANKI_FIELD_ORDER.every((field) =>
        fields.includes(field),
      );
    } catch {
      modelReady = false;
    }
  }

  return NextResponse.json({
    ok: true,
    reachable: true,
    deckReady,
    modelReady,
    deckName: VOCABULARY_ANKI_DECK_NAME,
    modelName: VOCABULARY_ANKI_MODEL_NAME,
  });
}
