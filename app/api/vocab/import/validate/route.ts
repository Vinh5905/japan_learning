import { NextResponse } from "next/server";
import {
  buildStandaloneVocabularyPreview,
  getNextVocabularyGroupName,
} from "@/lib/vocab-data";
import { parseStandaloneVocabularyImportJson } from "@/lib/vocab-validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { raw?: unknown };
  const raw = typeof body.raw === "string" ? body.raw : "";
  const parsed = parseStandaloneVocabularyImportJson(raw);

  if (!parsed.ok) {
    return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    preview: buildStandaloneVocabularyPreview(
      parsed.payload,
      await getNextVocabularyGroupName(),
    ),
  });
}
