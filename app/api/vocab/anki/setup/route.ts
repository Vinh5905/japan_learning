import { NextResponse } from "next/server";
import {
  VOCABULARY_ANKI_CARD_CSS,
  VOCABULARY_ANKI_CARD_TEMPLATES,
  VOCABULARY_ANKI_DECK_NAME,
  VOCABULARY_ANKI_FIELD_ORDER,
  VOCABULARY_ANKI_MODEL_NAME,
  AnkiConnectError,
  ankiCreateDeck,
  ankiCreateModel,
  ankiDeckNames,
  ankiModelFieldNames,
  ankiModelNames,
  ankiVersion,
} from "@/lib/anki";

export const runtime = "nodejs";

export async function POST() {
  try {
    await ankiVersion();

    const steps: string[] = [];
    const decks = await ankiDeckNames();

    if (!decks.includes(VOCABULARY_ANKI_DECK_NAME)) {
      await ankiCreateDeck(VOCABULARY_ANKI_DECK_NAME);
      steps.push(`Created deck "${VOCABULARY_ANKI_DECK_NAME}".`);
    } else {
      steps.push(`Deck "${VOCABULARY_ANKI_DECK_NAME}" already exists.`);
    }

    const models = await ankiModelNames();
    const modelExists = models.includes(VOCABULARY_ANKI_MODEL_NAME);

    if (!modelExists) {
      await ankiCreateModel({
        modelName: VOCABULARY_ANKI_MODEL_NAME,
        inOrderFields: VOCABULARY_ANKI_FIELD_ORDER,
        css: VOCABULARY_ANKI_CARD_CSS,
        cardTemplates: VOCABULARY_ANKI_CARD_TEMPLATES,
      });
      steps.push(`Created note type "${VOCABULARY_ANKI_MODEL_NAME}".`);
    } else {
      const fields = await ankiModelFieldNames(VOCABULARY_ANKI_MODEL_NAME);
      const missing = VOCABULARY_ANKI_FIELD_ORDER.filter(
        (field) => !fields.includes(field),
      );

      if (missing.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            message: `Note type "${VOCABULARY_ANKI_MODEL_NAME}" already exists but is missing fields: ${missing.join(", ")}. Rename or delete that note type in Anki, then run setup again.`,
            steps,
            deckReady: true,
            modelReady: false,
          },
          { status: 409 },
        );
      }

      steps.push(
        `Note type "${VOCABULARY_ANKI_MODEL_NAME}" already exists with the right fields.`,
      );
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
