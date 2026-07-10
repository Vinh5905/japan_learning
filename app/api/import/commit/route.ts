import { NextResponse } from "next/server";
import { commitImport } from "@/lib/data";
import type { ImportCommitRequest } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<ImportCommitRequest>;

  if (typeof body.raw !== "string") {
    return NextResponse.json(
      { ok: false, errors: [{ path: "$.raw", message: "raw is required" }] },
      { status: 400 },
    );
  }

  const result = await commitImport({
    raw: body.raw,
    kanjiDecisions: body.kanjiDecisions,
    vocabularyDecisions: body.vocabularyDecisions,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
