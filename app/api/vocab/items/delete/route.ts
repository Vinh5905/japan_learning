import { NextResponse } from "next/server";
import { deleteStandaloneVocabularyItem } from "@/lib/vocab-data";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  const body = (await request.json()) as {
    id?: unknown;
  };

  if (typeof body.id !== "string") {
    return NextResponse.json(
      { ok: false, message: "id is required" },
      { status: 400 },
    );
  }

  const result = await deleteStandaloneVocabularyItem(body.id);
  return NextResponse.json(result);
}
