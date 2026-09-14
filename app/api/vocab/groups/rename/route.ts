import { NextResponse } from "next/server";
import { renameVocabGroup } from "@/lib/vocab-data";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    groupId?: unknown;
    name?: unknown;
  };

  if (typeof body.groupId !== "string" || typeof body.name !== "string") {
    return NextResponse.json(
      { ok: false, message: "groupId and name are required" },
      { status: 400 },
    );
  }

  const result = await renameVocabGroup(body.groupId, body.name);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
