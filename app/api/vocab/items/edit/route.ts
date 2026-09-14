import { NextResponse } from "next/server";
import { updateStandaloneVocabularyItem } from "@/lib/vocab-data";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    id?: unknown;
    data?: unknown;
  };

  if (
    typeof body.id !== "string" ||
    typeof body.data !== "object" ||
    body.data === null
  ) {
    return NextResponse.json(
      { ok: false, message: "id and data are required" },
      { status: 400 },
    );
  }

  const result = await updateStandaloneVocabularyItem({
    id: body.id,
    data: body.data as Record<string, unknown>,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
