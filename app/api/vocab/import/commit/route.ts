import { NextResponse } from "next/server";
import { commitStandaloneVocabularyImport } from "@/lib/vocab-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { raw?: unknown };

  if (typeof body.raw !== "string") {
    return NextResponse.json(
      { ok: false, errors: [{ path: "$.raw", message: "raw is required" }] },
      { status: 400 },
    );
  }

  const result = await commitStandaloneVocabularyImport(body.raw);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
