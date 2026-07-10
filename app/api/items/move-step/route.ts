import { NextResponse } from "next/server";
import { moveStep } from "@/lib/data";
import type { MoveDirection, MoveTargetType } from "@/lib/types";

export const runtime = "nodejs";

const TARGET_TYPES: MoveTargetType[] = ["group", "kanji", "vocabulary"];
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
    !TARGET_TYPES.includes(body.type as MoveTargetType) ||
    !DIRECTIONS.includes(body.direction as MoveDirection)
  ) {
    return NextResponse.json(
      { ok: false, message: "type, id, and direction are required" },
      { status: 400 },
    );
  }

  const data = await moveStep({
    type: body.type as MoveTargetType,
    id: body.id,
    direction: body.direction as MoveDirection,
  });

  return NextResponse.json({ ok: true, data });
}
