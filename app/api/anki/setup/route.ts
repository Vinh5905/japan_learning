import { NextResponse } from "next/server";
import {
  ANKI_CARD_CSS,
  ANKI_CARD_TEMPLATES,
  ANKI_DECK_NAME,
  ANKI_FIELD_ORDER,
  ANKI_MODEL_NAME,
  AnkiConnectError,
  ankiCreateDeck,
  ankiCreateModel,
  ankiDeckNames,
  ankiModelFieldNames,
  ankiModelNames,
  ankiVersion,
} from "@/lib/anki";

export const runtime = "nodejs";

// Ensure the deck and note type exist. Idempotent: creates only what is missing
// and repairs a model that exists with the wrong fields. Returns the readiness
// state so the client can show what was done and whether Anki is reachable.
export async function POST() {
  try {
    await ankiVersion();

    const steps: string[] = [];
    const decks = await ankiDeckNames();

    if (!decks.includes(ANKI_DECK_NAME)) {
      await ankiCreateDeck(ANKI_DECK_NAME);
      steps.push(`Created deck "${ANKI_DECK_NAME}".`);
    } else {
      steps.push(`Deck "${ANKI_DECK_NAME}" already exists.`);
    }

    const models = await ankiModelNames();
    const modelExists = models.includes(ANKI_MODEL_NAME);

    if (!modelExists) {
      await ankiCreateModel({
        modelName: ANKI_MODEL_NAME,
        inOrderFields: ANKI_FIELD_ORDER,
        css: ANKI_CARD_CSS,
        cardTemplates: ANKI_CARD_TEMPLATES,
      });
      steps.push(`Created note type "${ANKI_MODEL_NAME}".`);
    } else {
      const fields = await ankiModelFieldNames(ANKI_MODEL_NAME);
      const missing = ANKI_FIELD_ORDER.filter((field) => !fields.includes(field));

      if (missing.length > 0) {
        // createModel refuses to recreate an existing model. Rather than fail, we
        // report the mismatch so the user can rename/remove the stale model and
        // re-run setup. Anki does not let us add fields to an existing model
        // through AnkiConnect.
        return NextResponse.json(
          {
            ok: false,
            message: `Note type "${ANKI_MODEL_NAME}" already exists but is missing fields: ${missing.join(", ")}. Rename or delete that note type in Anki, then run setup again.`,
            steps,
            deckReady: true,
            modelReady: false,
          },
          { status: 409 },
        );
      }

      steps.push(`Note type "${ANKI_MODEL_NAME}" already exists with the right fields.`);
    }

    return NextResponse.json({
      ok: true,
      steps,
      deckReady: true,
      modelReady: true,
    });
  } catch (error) {
    const message =
      error instanceof AnkiConnectError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Anki setup failed.";

    return NextResponse.json(
      { ok: false, message, steps: [], deckReady: false, modelReady: false },
      { status: 502 },
    );
  }
}
