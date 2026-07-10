import { NextResponse } from "next/server";
import { deleteItem } from "@/lib/data";
import type { EditableItemType } from "@/lib/types";

export const runtime = "nodejs";

const DELETABLE_TYPES: EditableItemType[] = ["kanji", "vocabulary"];

export async function DELETE(request: Request) {
  const body = (await request.json()) as {
    type?: unknown;
    id?: unknown;
  };

  if (
    typeof body.type !== "string" ||
    typeof body.id !== "string" ||
    !DELETABLE_TYPES.includes(body.type as EditableItemType)
  ) {
    return NextResponse.json(
      { ok: false, message: "type and id are required" },
      { status: 400 },
    );
  }

  const data = await deleteItem({
    type: body.type as EditableItemType,
    id: body.id,
  });

  return NextResponse.json(data);
}
