import { NextResponse } from "next/server";
import {
  moveStandaloneVocabularyStep,
  moveVocabGroupStep,
} from "@/lib/vocab-data";
import type {
  MoveDirection,
  StandaloneVocabularyMoveTargetType,
} from "@/lib/types";

export const runtime = "nodejs";

const TARGET_TYPES: StandaloneVocabularyMoveTargetType[] = [
  "vocabGroup",
  "standaloneVocabulary",
];
const DIRECTIONS: MoveDirection[] = ["up", "down"];

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    type?: unknown;
    id?: unknown;
    direction?: unknown;
  };

  if (
    typeof body.type !== "string" ||
    typeof body.id !== "string" ||
    typeof body.direction !== "string" ||
    !TARGET_TYPES.includes(body.type as StandaloneVocabularyMoveTargetType) ||
    !DIRECTIONS.includes(body.direction as MoveDirection)
  ) {
    return NextResponse.json(
      { ok: false, message: "type, id, and direction are required" },
      { status: 400 },
    );
  }

  const data =
    body.type === "vocabGroup"
      ? await moveVocabGroupStep(body.id, body.direction as MoveDirection)
      : await moveStandaloneVocabularyStep(body.id, body.direction as MoveDirection);

  return NextResponse.json({ ok: true, data });
}
