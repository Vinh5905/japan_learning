import { NextResponse } from "next/server";
import { setVocabGroupCollapsed } from "@/lib/vocab-data";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    groupId?: unknown;
    isCollapsed?: unknown;
  };

  if (typeof body.groupId !== "string" || typeof body.isCollapsed !== "boolean") {
    return NextResponse.json(
      { ok: false, message: "groupId and isCollapsed are required" },
      { status: 400 },
    );
  }

  await setVocabGroupCollapsed(body.groupId, body.isCollapsed);
  return NextResponse.json({ ok: true });
}
