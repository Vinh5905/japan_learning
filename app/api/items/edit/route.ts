import { NextResponse } from "next/server";
import { updateItem } from "@/lib/data";
import type { EditableItemType } from "@/lib/types";

export const runtime = "nodejs";

const EDITABLE_TYPES: EditableItemType[] = ["kanji", "vocabulary"];

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    type?: unknown;
    id?: unknown;
    data?: unknown;
  };

  if (
    typeof body.type !== "string" ||
    typeof body.id !== "string" ||
    !EDITABLE_TYPES.includes(body.type as EditableItemType) ||
    typeof body.data !== "object" ||
    body.data === null
  ) {
    return NextResponse.json(
      { ok: false, message: "type, id, and data are required" },
      { status: 400 },
    );
  }

  try {
    const result = await updateItem({
      type: body.type as EditableItemType,
      id: body.id,
      data: body.data as Record<string, unknown>,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error && error.message.includes("Unique constraint")
            ? "Kanji already exists"
            : "Failed to save item",
      },
      { status: 400 },
    );
  }
}
